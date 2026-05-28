import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const UI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FA',
  text: '#101010',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#e60000',
  accentGlow: 'rgba(230, 0, 0, 0.12)',
  blue: '#1B6EF3',
  blueSoft: '#E8F1FE',
  green: '#12B76A',
  greenSoft: '#ECFDF3',
  divider: 'rgba(0,0,0,0.06)',
  shadow: '#000000',
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
});

const LEVEL_3D_ICONS: Record<LevelId, string> = {
  beginner: 'https://img.icons8.com/3d-fluency/48/seedling.png',
  intermediate: 'https://img.icons8.com/3d-fluency/48/graduation-cap.png',
  advanced: 'https://img.icons8.com/3d-fluency/48/medal2.png',
};

const GAME_LIST: {
  id: GameId;
  title: string;
  imageUrl: string;
  bg: string;
  totalLevels: number;
  scored: boolean;
}[] = [
  {
    id: 'quiz',
    title: 'Word Quiz',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/help.png',
    bg: '#FFF5F5',
    totalLevels: QUIZ_LEVEL_COUNT,
    scored: true,
  },
  {
    id: 'scramble',
    title: 'Word Scramble',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/puzzle.png',
    bg: '#F3F0FF',
    totalLevels: SCRAMBLE_LEVEL_COUNT,
    scored: true,
  },
  {
    id: 'fill',
    title: 'Fill in the Blanks',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/pencil.png',
    bg: '#ECFDF3',
    totalLevels: FILL_BLANK_LEVEL_COUNT,
    scored: true,
  },
  {
    id: 'flash',
    title: 'Flashcards',
    imageUrl: 'https://img.icons8.com/3d-fluency/48/cards.png',
    bg: '#E8F1FE',
    totalLevels: FLASHCARD_LEVEL_COUNT,
    scored: false,
  },
];

function SectionLabel({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function StatTile({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statTileIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={UI.text} />
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={styles.statTileValue}>{value}</Text>
    </View>
  );
}

function CategorySegmented({
  selected,
  onSelect,
}: {
  selected: PerformanceCategory;
  onSelect: (id: PerformanceCategory) => void;
}) {
  const tabs: { id: PerformanceCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: 'games', label: 'Games', icon: 'grid' },
    { id: 'courses', label: 'Courses', icon: 'play-circle' },
  ];

  return (
    <View style={styles.segmented}>
      {tabs.map((tab) => {
        const active = selected === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(tab.id)}
          >
            <Feather name={tab.icon} size={18} color={active ? UI.accent : UI.textTertiary} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OverallHeroCard({
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
    <View style={styles.heroCard}>
      <LinearGradient
        colors={['#FFFFFF', '#FFF8F8', '#FFEFEF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroEyebrow}>Game performance</Text>
            <View style={styles.heroAccuracyRow}>
              <Text style={styles.heroAccuracy}>{accuracy}%</Text>
              <Text style={styles.heroAccuracyUnit}>accuracy</Text>
            </View>
          </View>
          <View style={styles.heroBadge}>
            <Feather name="target" size={26} color={UI.accent} />
          </View>
        </View>

        <View style={styles.heroBarTrack}>
          <LinearGradient
            colors={[UI.accent, '#ff5a5a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.heroBarFill, { width: `${Math.max(accuracy, totalAnswered > 0 ? 4 : 0)}%` }]}
          />
        </View>
        <Text style={styles.heroMeta}>
          {totalAnswered === 0 ? 'No answers yet — play a game to start' : `${totalAnswered} questions answered`}
        </Text>

        <View style={styles.heroDivider} />

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{correct}</Text>
            <Text style={styles.heroStatLabel}>Correct</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{incorrect}</Text>
            <Text style={styles.heroStatLabel}>Incorrect</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{points}</Text>
            <Text style={styles.heroStatLabel}>Points</Text>
          </View>
        </View>
        <Text style={styles.heroFootnote}>{POINTS_PER_CORRECT_LEVEL} pts per correct answer</Text>
      </LinearGradient>
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
      <View style={styles.listRow}>
        <View style={[styles.listIcon, { backgroundColor: game.bg }]}>
          <Image source={{ uri: game.imageUrl }} style={styles.listIconImg} resizeMode="contain" />
        </View>
        <View style={styles.listBody}>
          <View style={styles.listTop}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {game.title}
            </Text>
            <Text style={styles.listMetric}>
              {game.scored ? (answered > 0 ? `${accuracy}%` : '—') : 'Study'}
            </Text>
          </View>
          <Text style={styles.listSub}>
            Level {Math.min(level, game.totalLevels)} of {game.totalLevels}
          </Text>
          {game.scored ? (
            <Text style={styles.listMeta}>
              {stats.correct} correct · {stats.incorrect} wrong · {stats.points} pts
            </Text>
          ) : (
            <Text style={styles.listMeta}>{levelIndex} cards reached</Text>
          )}
        </View>
      </View>
      {!isLast ? <View style={styles.listSeparator} /> : null}
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
      <View style={[styles.listRow, !unlocked && styles.listRowLocked]}>
        <View style={[styles.listIcon, { backgroundColor: `${level.color[0]}18` }]}>
          <Image
            source={{ uri: levelIconUrl }}
            style={[styles.listIconImg, !unlocked && styles.listIconLocked]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.listBody}>
          <View style={styles.listTop}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {level.title}
            </Text>
            <Text style={[styles.listMetric, !unlocked && styles.listMetricMuted]}>
              {unlocked ? `${percent}%` : 'Locked'}
            </Text>
          </View>
          <Text style={styles.listSub} numberOfLines={1}>
            {level.subtitle}
          </Text>
          <View style={styles.levelBarTrack}>
            <View
              style={[
                styles.levelBarFill,
                {
                  width: `${Math.max(percent, unlocked && percent > 0 ? 4 : 0)}%`,
                  backgroundColor: level.color[0],
                },
              ]}
            />
          </View>
          <Text style={styles.listMeta}>
            {unlocked
              ? `${completedCount} of ${level.lessons.length} lessons`
              : 'Complete previous level to unlock'}
          </Text>
        </View>
        {!unlocked ? <Feather name="lock" size={18} color={UI.textTertiary} /> : null}
      </View>
      {!isLast ? <View style={styles.listSeparator} /> : null}
    </>
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
    }, [load])
  );

  const totals = stats ? getTotals(stats) : { correct: 0, incorrect: 0, points: 0 };
  const totalAnswered = totals.correct + totals.incorrect;
  const accuracy = totalAnswered > 0 ? Math.round((totals.correct / totalAnswered) * 100) : 0;
  const overallCourseProgress = getOverallProgress(completedLessons);
  const lastLessonTitle = getLastLessonTitle(lastLessonId);

  const pageSubtitle =
    category === 'games'
      ? 'Track accuracy and points across all games'
      : 'Video lessons and course completion';

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.navBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={24} color={UI.text} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            Performance
          </Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={UI.accent} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        >
          <Text style={styles.pageSubtitle}>{pageSubtitle}</Text>

          <CategorySegmented selected={category} onSelect={setCategory} />

          {category === 'games' ? (
            <>
              <OverallHeroCard
                correct={totals.correct}
                incorrect={totals.incorrect}
                points={totals.points}
                accuracy={accuracy}
                totalAnswered={totalAnswered}
              />

              <View style={styles.statRow}>
                <StatTile icon="check-circle" iconBg={UI.greenSoft} label="Correct" value={String(totals.correct)} />
                <StatTile icon="x-circle" iconBg={UI.accentGlow} label="Incorrect" value={String(totals.incorrect)} />
              </View>

              <SectionLabel title="By game" action={`${GAME_LIST.length} activities`} />
              <View style={styles.listGroup}>
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
                  <View style={styles.congratsIcon}>
                    <Feather name="award" size={28} color={UI.accent} />
                  </View>
                  <Text style={styles.congratsTitle}>Course complete</Text>
                  <Text style={styles.congratsText}>
                    You finished every lesson on the English roadmap. Great work!
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.certBtn, pressed && styles.certBtnPressed]}
                    onPress={() => Alert.alert('Certificate', 'Certificate feature coming soon!')}
                  >
                    <LinearGradient
                      colors={[UI.accent, '#ff4d4d']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.certBtnGradient}
                    >
                      <Text style={styles.certBtnText}>Get certificate</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}

              <SectionLabel title="By level" action={`${COURSE_DATA.length} levels`} />
              <View style={styles.listGroup}>
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
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  safeTop: {
    backgroundColor: UI.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    minHeight: 48,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  backBtnPressed: {
    opacity: 0.85,
  },
  navTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.4,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  pageSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: UI.textSecondary,
    marginBottom: 20,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: UI.surfaceMuted,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: UI.surface,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: UI.textTertiary,
  },
  segmentTextActive: {
    color: UI.text,
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    ...cardShadow,
  },
  heroGradient: {
    padding: 22,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.textSecondary,
  },
  heroAccuracyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  heroAccuracy: {
    fontSize: 44,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -1.5,
  },
  heroAccuracyUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: UI.textSecondary,
    marginBottom: 8,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: UI.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECEEF2',
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroBarFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 8,
  },
  heroMeta: {
    fontSize: 13,
    color: UI.textSecondary,
    marginBottom: 16,
  },
  heroDivider: {
    height: 1,
    backgroundColor: UI.divider,
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: UI.text,
  },
  heroStatLabel: {
    fontSize: 12,
    color: UI.textTertiary,
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: UI.divider,
  },
  heroFootnote: {
    fontSize: 12,
    color: UI.textTertiary,
    textAlign: 'center',
    marginTop: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statTile: {
    flex: 1,
    backgroundColor: UI.surface,
    borderRadius: 22,
    padding: 16,
    ...cardShadow,
  },
  statTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statTileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: UI.textTertiary,
  },
  statTileValue: {
    fontSize: 22,
    fontWeight: '700',
    color: UI.text,
    marginTop: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.accent,
  },
  listGroup: {
    backgroundColor: UI.surface,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    ...cardShadow,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  listRowLocked: {
    opacity: 0.72,
  },
  listIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIconImg: {
    width: 32,
    height: 32,
  },
  listIconLocked: {
    opacity: 0.5,
  },
  listBody: {
    flex: 1,
    minWidth: 0,
  },
  listTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: UI.text,
  },
  listMetric: {
    fontSize: 15,
    fontWeight: '700',
    color: UI.accent,
  },
  listMetricMuted: {
    color: UI.textTertiary,
    fontWeight: '600',
  },
  listSub: {
    fontSize: 13,
    color: UI.textSecondary,
    marginTop: 3,
  },
  listMeta: {
    fontSize: 12,
    color: UI.textTertiary,
    marginTop: 8,
    lineHeight: 17,
  },
  listSeparator: {
    height: 1,
    backgroundColor: UI.divider,
    marginLeft: 80,
  },
  levelBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ECEEF2',
    overflow: 'hidden',
    marginTop: 10,
  },
  levelBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },
  congratsCard: {
    backgroundColor: UI.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...cardShadow,
  },
  congratsIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: UI.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  congratsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI.text,
  },
  congratsText: {
    fontSize: 14,
    color: UI.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  certBtn: {
    marginTop: 18,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  certBtnPressed: {
    opacity: 0.9,
  },
  certBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  certBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
