import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import {
  QUIZ_LEVEL_COUNT,
  SCRAMBLE_LEVEL_COUNT,
  FILL_BLANK_LEVEL_COUNT,
  FLASHCARD_LEVEL_COUNT,
  POINTS_PER_CORRECT_LEVEL,
} from '@/constants/gameData';
import { COURSE_DATA, LevelId } from '@/constants/courseData';
import { CourseProgressCard } from '@/components/CourseProgressCard';
import { GameId, loadAllGameProgress } from '@/utils/gameProgress';
import { loadAllGameStats, getTotals, GameStats } from '@/utils/gameStats';
import {
  getOverallProgress,
  getLastLessonTitle,
  getLevelCompletedCount,
  getLevelProgressRatio,
  isLevelUnlocked,
  loadCourseProgress,
} from '@/utils/courseProgress';

type PerformanceCategory = 'games' | 'courses';

/** Icons8 3D Fluency — https://icons8.com/icons/fluency */
const PERF_GAMES_TAB_LOGO = 'https://img.icons8.com/3d-fluency/48/controller.png';
const PERF_COURSES_TAB_LOGO = 'https://img.icons8.com/3d-fluency/48/video.png';
const PERF_OVERALL_LOGO = 'https://img.icons8.com/3d-fluency/48/goal.png';

const LEVEL_3D_ICONS: Record<LevelId, string> = {
  beginner: 'https://img.icons8.com/3d-fluency/48/seedling.png',
  intermediate: 'https://img.icons8.com/3d-fluency/48/graduation-cap.png',
  advanced: 'https://img.icons8.com/3d-fluency/48/medal2.png',
};

const GAME_LIST: {
  id: GameId;
  title: string;
  imageUrl: string;
  color: string;
  bg: string;
  totalLevels: number;
  scored: boolean;
}[] = [
  {
    id: 'quiz',
    title: 'Word Quiz',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/help.png',
    color: '#e60000',
    bg: '#FFF5F5',
    totalLevels: QUIZ_LEVEL_COUNT,
    scored: true,
  },
  {
    id: 'scramble',
    title: 'Word Scramble',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/puzzle.png',
    color: '#6C5CE7',
    bg: '#F3F0FF',
    totalLevels: SCRAMBLE_LEVEL_COUNT,
    scored: true,
  },
  {
    id: 'fill',
    title: 'Fill in the Blanks',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/pencil.png',
    color: '#00b894',
    bg: '#EBFBEE',
    totalLevels: FILL_BLANK_LEVEL_COUNT,
    scored: true,
  },
  {
    id: 'flash',
    title: 'Flashcards',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/cards.png',
    color: '#0984e3',
    bg: '#E1F5FE',
    totalLevels: FLASHCARD_LEVEL_COUNT,
    scored: false,
  },
];

function SectionHeading({ title, inset }: { title: string; inset?: boolean }) {
  return (
    <View style={[styles.cardSectionHeader, inset && styles.cardSectionHeaderInset]}>
      <Text style={styles.cardSectionHeaderText}>{title}</Text>
      <View style={[styles.cardSectionHeaderLine, inset && styles.cardSectionHeaderLineInset]} />
    </View>
  );
}

function PerformanceCategoryTabs({
  selected,
  onSelect,
}: {
  selected: PerformanceCategory;
  onSelect: (id: PerformanceCategory) => void;
}) {
  const tabs: { id: PerformanceCategory; label: string; imageUrl: string }[] = [
    { id: 'games', label: 'Games', imageUrl: PERF_GAMES_TAB_LOGO },
    { id: 'courses', label: 'Courses', imageUrl: PERF_COURSES_TAB_LOGO },
  ];

  return (
    <View style={styles.categoryTabs}>
      {tabs.map((tab) => {
        const active = selected === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.categoryTab, active && styles.categoryTabActive]}
            onPress={() => onSelect(tab.id)}
            activeOpacity={0.75}
          >
            <Image source={{ uri: tab.imageUrl }} style={styles.categoryTabIcon} resizeMode="contain" />
            <Text style={[styles.categoryTabLabel, active && styles.categoryTabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function GameListItem({
  game,
  stats,
  levelIndex,
  isLast,
}: {
  game: (typeof GAME_LIST)[0];
  stats: GameStats;
  levelIndex: number;
  isLast: boolean;
}) {
  const level = levelIndex + 1;
  const answered = stats.correct + stats.incorrect;
  const accuracy = answered > 0 ? Math.round((stats.correct / answered) * 100) : 0;

  return (
    <>
      <View style={styles.gameListItem}>
        <View style={[styles.gameListIconWrap, { backgroundColor: game.bg }]}>
          <Image source={{ uri: game.imageUrl }} style={styles.gameListIconImage} resizeMode="contain" />
        </View>
        <View style={styles.gameListBody}>
          <View style={styles.gameListTopRow}>
            <Text style={styles.gameListTitle} numberOfLines={1}>
              {game.title}
            </Text>
            {game.scored ? (
              <Text style={styles.gameListMetric}>
                {answered > 0 ? `${accuracy}%` : '—'}
              </Text>
            ) : (
              <Text style={styles.gameListMetricMuted}>Study</Text>
            )}
          </View>
          <Text style={styles.gameListSub}>
            Level {Math.min(level, game.totalLevels)} of {game.totalLevels}
          </Text>
          {game.scored ? (
            <View style={styles.gameListStatsRow}>
              <Text style={styles.gameListStat}>
                <Text style={styles.gameListStatValue}>{stats.correct}</Text> correct
              </Text>
              <Text style={styles.gameListStatDot}>·</Text>
              <Text style={styles.gameListStat}>
                <Text style={styles.gameListStatValue}>{stats.incorrect}</Text> incorrect
              </Text>
              <Text style={styles.gameListStatDot}>·</Text>
              <Text style={styles.gameListStat}>
                <Text style={styles.gameListStatValue}>{stats.points}</Text> pts
              </Text>
            </View>
          ) : (
            <Text style={styles.gameListStatsRow}>
              {levelIndex} cards reached · no scoring
            </Text>
          )}
        </View>
      </View>
      {!isLast && <View style={styles.gameListDivider} />}
    </>
  );
}

function CourseLevelListItem({
  level,
  completedCount,
  progress,
  unlocked,
  isLast,
}: {
  level: (typeof COURSE_DATA)[0];
  completedCount: number;
  progress: number;
  unlocked: boolean;
  isLast: boolean;
}) {
  const percent = Math.round(progress * 100);
  const levelIconUrl = LEVEL_3D_ICONS[level.id];

  return (
    <>
      <View style={[styles.gameListItem, !unlocked && styles.courseLevelLocked]}>
        <View style={[styles.gameListIconWrap, { backgroundColor: `${level.color[0]}18` }]}>
          <Image
            source={{ uri: levelIconUrl }}
            style={[styles.gameListIconImage, !unlocked && styles.gameListIconImageLocked]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.gameListBody}>
          <View style={styles.gameListTopRow}>
            <Text style={styles.gameListTitle} numberOfLines={1}>
              {level.title}
            </Text>
            <Text style={styles.gameListMetric}>{unlocked ? `${percent}%` : 'Locked'}</Text>
          </View>
          <Text style={styles.gameListSub} numberOfLines={1}>
            {level.subtitle}
          </Text>
          <View style={styles.courseLevelProgressTrack}>
            <View
              style={[
                styles.courseLevelProgressFill,
                { width: `${Math.max(percent, unlocked && percent > 0 ? 4 : 0)}%`, backgroundColor: level.color[0] },
              ]}
            />
          </View>
          <Text style={styles.gameListStatsRow}>
            {unlocked
              ? `${completedCount} of ${level.lessons.length} lessons completed`
              : 'Finish the previous level to unlock'}
          </Text>
        </View>
        {!unlocked && <Feather name="lock" size={16} color="#9AA0A6" style={styles.courseLevelLockIcon} />}
      </View>
      {!isLast && <View style={styles.gameListDivider} />}
    </>
  );
}

function OverallCard({
  correct,
  incorrect,
  points,
  accuracy,
  totalAnswered,
}: {
  correct: number;
  incorrect: number;
  points: number;
  accuracy: number;
  totalAnswered: number;
}) {
  return (
    <View style={styles.overallCard}>
      <View style={[styles.cornerCircle, styles.cornerCircleTL]} />
      <View style={[styles.cornerCircle, styles.cornerCircleTR]} />
      <View style={[styles.cornerCircle, styles.cornerCircleBL]} />
      <View style={[styles.cornerCircle, styles.cornerCircleBR]} />

      <View style={styles.cornerGameBadge}>
        <Image source={{ uri: PERF_OVERALL_LOGO }} style={styles.cornerGameBadgeImage} resizeMode="contain" />
      </View>
      <View style={styles.cornerGameDots}>
        <View style={[styles.gameDot, { backgroundColor: '#e60000' }]} />
        <View style={[styles.gameDot, { backgroundColor: '#6C5CE7' }]} />
        <View style={[styles.gameDot, { backgroundColor: '#00b894' }]} />
        <View style={[styles.gameDot, { backgroundColor: '#0984e3' }]} />
      </View>

      <View style={styles.overallCardContent}>
        <SectionHeading title="Overall" />

        <View style={styles.overallHero}>
          <Text style={styles.overallHeroValue}>{accuracy}%</Text>
          <Text style={styles.overallHeroCaption}>Accuracy</Text>
        </View>

        <View style={styles.overallProgressTrack}>
          <View style={[styles.overallProgressFill, { width: `${Math.max(accuracy, totalAnswered > 0 ? 4 : 0)}%` }]} />
        </View>
        <Text style={styles.overallMeta}>
          {totalAnswered === 0 ? 'No answers yet' : `${totalAnswered} questions answered`}
        </Text>

        <View style={styles.overallDivider} />

        <View style={styles.overallStatsRow}>
          <View style={styles.overallStatItem}>
            <Text style={styles.overallStatValue}>{correct}</Text>
            <Text style={styles.overallStatLabel}>Correct</Text>
          </View>
          <View style={styles.overallStatDivider} />
          <View style={styles.overallStatItem}>
            <Text style={styles.overallStatValue}>{incorrect}</Text>
            <Text style={styles.overallStatLabel}>Incorrect</Text>
          </View>
          <View style={styles.overallStatDivider} />
          <View style={styles.overallStatItem}>
            <Text style={styles.overallStatValue}>{points}</Text>
            <Text style={styles.overallStatLabel}>Points</Text>
          </View>
        </View>

        <Text style={styles.overallFootnote}>
          {POINTS_PER_CORRECT_LEVEL} points earned per correct answer
        </Text>
      </View>
    </View>
  );
}

export default function PerformanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<PerformanceCategory>('games');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<GameId, GameStats> | null>(null);
  const [levels, setLevels] = useState<Record<GameId, number> | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [lastLessonId, setLastLessonId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gameStats, progress, courseProgress] = await Promise.all([
        loadAllGameStats(),
        loadAllGameProgress(),
        loadCourseProgress(),
      ]);
      setStats(gameStats);
      setLevels({
        quiz: progress.quiz.level,
        scramble: progress.scramble.level,
        fill: progress.fill.level,
        flash: progress.flash.level,
      });
      setCompletedLessons(courseProgress.completedLessons);
      setLastLessonId(courseProgress.lastLessonId);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = stats ? getTotals(stats) : { correct: 0, incorrect: 0, points: 0 };
  const totalAnswered = totals.correct + totals.incorrect;
  const accuracy = totalAnswered > 0 ? Math.round((totals.correct / totalAnswered) * 100) : 0;
  const overallCourseProgress = getOverallProgress(completedLessons);
  const lastLessonTitle = getLastLessonTitle(lastLessonId);

  const headerSub =
    category === 'games'
      ? 'Your game stats by activity'
      : 'Video lessons and course completion';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFE8E8" />

      <LinearGradient
        colors={['#FFD6D6', '#FFF0F0', '#F8F9FA']}
        locations={[0, 0.55, 1]}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={24} color="#1F1F1F" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Performance</Text>
            <Text style={styles.headerSub}>{headerSub}</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1A73E8" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <PerformanceCategoryTabs selected={category} onSelect={setCategory} />

          {category === 'games' ? (
            <>
              <OverallCard
                correct={totals.correct}
                incorrect={totals.incorrect}
                points={totals.points}
                accuracy={accuracy}
                totalAnswered={totalAnswered}
              />

              <View style={styles.gamesSection}>
                <View style={styles.gamesListCard}>
                  <SectionHeading title="By game" inset />
                  {GAME_LIST.map((game, index) => (
                    <GameListItem
                      key={game.id}
                      game={game}
                      stats={stats?.[game.id] ?? { correct: 0, incorrect: 0, points: 0 }}
                      levelIndex={levels?.[game.id] ?? 0}
                      isLast={index === GAME_LIST.length - 1}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : (
            <>
              <CourseProgressCard
                overallProgress={overallCourseProgress}
                completedCount={completedLessons.length}
                lastLessonTitle={lastLessonTitle}
                onContinue={() => router.push('/(tabs)/my-courses')}
              />

              {overallCourseProgress === 100 && (
                <View style={styles.congratsCard}>
                  <Image
                    source={{ uri: 'https://img.icons8.com/3d-fluency/48/party.png' }}
                    style={styles.congratsLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.congratsTitle}>Course complete</Text>
                  <Text style={styles.congratsText}>
                    You finished every lesson on the English roadmap. Great work!
                  </Text>
                  <TouchableOpacity
                    style={styles.certBtn}
                    onPress={() => Alert.alert('Certificate', 'Certificate feature coming soon!')}
                  >
                    <Text style={styles.certBtnText}>Get certificate</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.gamesSection}>
                <View style={styles.gamesListCard}>
                  <SectionHeading title="By level" inset />
                  {COURSE_DATA.map((level, index) => (
                    <CourseLevelListItem
                      key={level.id}
                      level={level}
                      completedCount={getLevelCompletedCount(level.id as LevelId, completedLessons)}
                      progress={getLevelProgressRatio(level.id as LevelId, completedLessons)}
                      unlocked={isLevelUnlocked(level.id as LevelId, completedLessons)}
                      isLast={index === COURSE_DATA.length - 1}
                    />
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: 16,
  },
  headerTextBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
    minWidth: 0,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: 0,
  },
  headerSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5F6368',
    marginTop: 2,
    lineHeight: 20,
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 14, paddingBottom: 32 },
  categoryTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8EAED',
  },
  categoryTabActive: {
    borderColor: '#1A73E8',
    backgroundColor: '#E8F0FE',
  },
  categoryTabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6368',
  },
  categoryTabLabelActive: {
    color: '#1A73E8',
    fontWeight: '700',
  },
  categoryTabIcon: {
    width: 22,
    height: 22,
  },
  overallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EAED',
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  overallCardContent: {
    zIndex: 1,
  },
  cornerCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  cornerCircleTL: {
    width: 70,
    height: 70,
    top: -28,
    left: -28,
    backgroundColor: 'rgba(230, 0, 0, 0.09)',
  },
  cornerCircleTR: {
    width: 54,
    height: 54,
    top: -20,
    right: -18,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  cornerCircleBL: {
    width: 48,
    height: 48,
    bottom: -16,
    left: -14,
    backgroundColor: 'rgba(0, 184, 148, 0.1)',
  },
  cornerCircleBR: {
    width: 80,
    height: 80,
    bottom: -34,
    right: -30,
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
  },
  cornerGameBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 1,
    borderColor: '#D2E3FC',
  },
  cornerGameBadgeImage: {
    width: 26,
    height: 26,
  },
  cornerGameDots: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  gameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.85,
  },
  cardSectionHeader: {
    paddingTop: 2,
    paddingBottom: 0,
    marginBottom: 8,
  },
  cardSectionHeaderInset: {
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 0,
  },
  cardSectionHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6368',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cardSectionHeaderLine: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginBottom: 6,
  },
  cardSectionHeaderLineInset: {
    marginBottom: 4,
  },
  overallHero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  overallHeroValue: {
    fontSize: 36,
    fontWeight: '400',
    color: '#1F1F1F',
    letterSpacing: -0.5,
  },
  overallHeroCaption: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5F6368',
    marginTop: 2,
  },
  overallProgressTrack: {
    height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
    borderRadius: 2,
  },
  overallMeta: {
    fontSize: 12,
    color: '#5F6368',
    textAlign: 'center',
    marginBottom: 10,
  },
  overallDivider: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginBottom: 10,
  },
  overallStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overallStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  overallStatValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1F1F1F',
    letterSpacing: -0.3,
  },
  overallStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6368',
    marginTop: 2,
  },
  overallStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E8EAED',
  },
  overallFootnote: {
    fontSize: 11,
    color: '#80868B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
  gamesSection: {
    marginBottom: 8,
  },
  gamesListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    overflow: 'hidden',
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  gameListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  gameListIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    overflow: 'hidden',
  },
  gameListIconImage: {
    width: 36,
    height: 36,
  },
  gameListIconImageLocked: {
    opacity: 0.45,
  },
  gameListBody: {
    flex: 1,
    minWidth: 0,
  },
  gameListTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gameListTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1F1F1F',
    letterSpacing: 0.1,
  },
  gameListMetric: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A73E8',
  },
  gameListMetricMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: '#80868B',
  },
  gameListSub: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
    fontWeight: '400',
  },
  gameListStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    fontSize: 12,
    color: '#5F6368',
    lineHeight: 18,
  },
  gameListStat: {
    fontSize: 12,
    color: '#5F6368',
  },
  gameListStatValue: {
    fontWeight: '500',
    color: '#1F1F1F',
  },
  gameListStatDot: {
    fontSize: 12,
    color: '#80868B',
    marginHorizontal: 4,
  },
  gameListDivider: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginLeft: 70,
  },
  courseLevelLocked: {
    opacity: 0.72,
  },
  courseLevelLockIcon: {
    marginTop: 12,
    marginRight: 4,
  },
  courseLevelProgressTrack: {
    height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 2,
  },
  courseLevelProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  congratsCard: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EAED',
    marginBottom: 16,
  },
  congratsLogo: {
    width: 56,
    height: 56,
  },
  congratsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
    marginTop: 12,
  },
  congratsText: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  certBtn: {
    marginTop: 16,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  certBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
