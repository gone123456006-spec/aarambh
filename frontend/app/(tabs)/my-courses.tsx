import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StatusBar,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { downloadLessonPdf } from '@/utils/downloadPdf';
import {
  AppCategory,
  AppLesson,
  ApiCourse,
  mapApiCoursesToApp,
  iconForLevel,
  totalLessonCount,
} from '@/utils/liveCourses';
import {
  isLevelUnlocked,
  loadCourseProgress,
  saveCourseProgress,
  syncLessonToServer,
} from '@/utils/courseProgress';
import { apiFetch, ensureValidSession } from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CategorySlug,
  SubscriptionPlan,
  fetchSubscription,
  priceLabelForCategory,
} from '@/utils/subscriptionApi';
import SubscriptionCheckoutModal from '@/components/SubscriptionCheckoutModal';
import { Icons3D } from '@/constants/homeIcons';
import { useGameTabBar } from '@/contexts/game-tab-bar-context';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PLAYLIST_PLAYER_HEIGHT = SCREEN_WIDTH * (9 / 16);
const COURSES_CACHE_KEY = '@my_courses_ui_cache_v2';

/** Matches Rewards / Games screen background */
const UI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEEF2',
  divider: 'rgba(0,0,0,0.06)',
  text: '#101010',
  textSecondary: '#6B7280',
  accent: '#e60000',
  shadow: '#000000',
};

function asCategorySlug(id: string, title?: string): CategorySlug | null {
  const raw = `${id || ''} ${title || ''}`.trim().toLowerCase();
  if (raw.includes('beginner')) return 'beginner';
  if (raw.includes('intermediate')) return 'intermediate';
  if (raw.includes('advanced')) return 'advanced';
  if (id === 'beginner' || id === 'intermediate' || id === 'advanced') return id;
  return null;
}

/** Free when admin disabled the plan, set ₹0, or this is a custom category. */
function isCategoryFree(
  levelId: string,
  title: string | undefined,
  plans: SubscriptionPlan[],
  cat?: AppCategory,
): boolean {
  const slug = asCategorySlug(levelId, title);
  const plan = slug ? plans.find((p) => p.category === slug) : undefined;
  if (plan) return !plan.requiresPayment;
  if (!slug || slug === 'beginner' || /beginner/i.test(`${levelId} ${title || ''}`)) return true;
  return Boolean(cat && !cat.isPro && !cat.locked);
}

function formatDurationLabel(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const headerShadow = Platform.select({
  ios: {
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

function isLessonUnlockedInRoadmap(
  lessons: AppLesson[],
  index: number,
  completedLessons: string[],
) {
  if (index === 0) return true;
  return completedLessons.includes(lessons[index - 1].id);
}

function coursesSignature(categories: AppCategory[]) {
  return JSON.stringify(
    categories.map((c) => ({
      id: c.id,
      title: c.title,
      locked: c.locked,
      isPro: c.isPro,
      lessons: c.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        duration: l.duration,
        locked: l.locked,
        videoUrl: l.videoUrl || '',
        pdfUrl: l.pdfUrl || '',
      })),
    })),
  );
}

function PulseBlock({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.skeletonBlock, style, { opacity }]} />;
}

function CoursesLoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonTabs}>
        {[0, 1, 2].map((i) => (
          <PulseBlock key={i} style={styles.skeletonTab} />
        ))}
      </View>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <PulseBlock style={styles.skeletonThumb} />
          <View style={styles.skeletonTextCol}>
            <PulseBlock style={styles.skeletonTitle} />
            <PulseBlock style={styles.skeletonLine} />
            <PulseBlock style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SectionHeading({ title, inset }: { title: string; inset?: boolean }) {
  return (
    <View style={[styles.sectionHeader, inset && styles.sectionHeaderInset]}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <View style={[styles.sectionHeaderLine, inset && styles.sectionHeaderLineInset]} />
    </View>
  );
}

function CategoryTabs({
  categories,
  selected,
  onSelect,
  isLevelUnlocked,
}: {
  categories: AppCategory[];
  selected: string;
  onSelect: (id: string) => void;
  isLevelUnlocked: (id: string) => boolean;
}) {
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryRow}>
        {categories.map((level) => {
          const active = selected === level.id;
          const unlocked = isLevelUnlocked(level.id);

          return (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.categoryBtn,
                active && styles.categoryBtnActive,
                active && {
                  borderColor: level.color[0],
                  backgroundColor: level.color[0],
                },
              ]}
              onPress={() => onSelect(level.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryBtnLabel,
                  active && styles.categoryBtnLabelActive,
                ]}
                numberOfLines={1}
              >
                {level.title}
              </Text>
              {!unlocked ? (
                <Feather
                  name="lock"
                  size={11}
                  color={active ? 'rgba(255,255,255,0.95)' : UI.accent}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function lessonStatsLine(lesson: AppLesson, index: number, isDone: boolean, durationLabel?: string) {
  const parts = [`Lesson ${index + 1}`, durationLabel || lesson.duration || '0:00'];
  if (isDone) parts.push('Completed');
  return parts.join(' · ');
}

function PlaylistLessonRow({
  lesson,
  lessonIndex,
  level,
  unlocked,
  proLocked,
  unlockLabel,
  isDone,
  isActive,
  isPlaying,
  showReview,
  durationLabel,
  onPlay,
  onMenu,
  onDownloadPdf,
  isPdfDownloading = false,
  onNextLesson,
  onContinueToReview,
  onMarkComplete,
}: {
  lesson: AppLesson;
  lessonIndex: number;
  level: AppCategory;
  unlocked: boolean;
  proLocked: boolean;
  unlockLabel: string;
  isDone: boolean;
  isActive: boolean;
  isPlaying: boolean;
  showReview: boolean;
  durationLabel?: string;
  onPlay: () => void;
  onMenu: () => void;
  onDownloadPdf: () => void;
  isPdfDownloading?: boolean;
  onNextLesson: () => void;
  onContinueToReview: () => void;
  onMarkComplete: () => void;
}) {
  const showNowPlayingIcon = isActive && isPlaying;
  const displayDuration = durationLabel || lesson.duration || '0:00';

  return (
    <View style={[styles.playlistRowWrap, isActive && styles.playlistRowWrapActive]}>
      <View style={styles.playlistRow}>
        <TouchableOpacity
          style={styles.playlistRowMain}
          activeOpacity={0.7}
          onPress={onPlay}
        >
          <View style={styles.playlistDragHandle}>
            <View style={styles.playlistDragLine} />
            <View style={styles.playlistDragLine} />
          </View>

          <View style={styles.playlistThumbWrap}>
            <View style={[styles.playlistThumb, styles.videoFrameFallback]}>
              {unlocked ? <Ionicons name="play" size={18} color="#fff" /> : null}
            </View>
            {!unlocked && (
              <View style={styles.playlistThumbLock}>
                <Feather name="lock" size={16} color="#fff" />
              </View>
            )}
            {unlocked && showNowPlayingIcon && (
              <View style={styles.playlistNowPlayingBadge}>
                <MaterialCommunityIcons name="equalizer" size={14} color="#fff" />
              </View>
            )}
            {unlocked && !showNowPlayingIcon && isDone && (
              <View style={styles.playlistCompleteThumbBadge}>
                <Feather name="check-circle" size={16} color="#fff" />
              </View>
            )}
            {unlocked && !showNowPlayingIcon && !isDone && (
              <View style={styles.playlistThumbDuration}>
                <Text style={styles.durationText}>{displayDuration}</Text>
              </View>
            )}
            {!unlocked && (
              <View style={styles.playlistThumbDuration}>
                <Text style={styles.durationText}>{displayDuration}</Text>
              </View>
            )}
          </View>

          <View style={styles.playlistRowText}>
            <Text style={styles.playlistRowTitle} numberOfLines={2}>
              {lesson.title}
            </Text>
            <Text style={styles.playlistRowChannel} numberOfLines={1}>
              Ohm&apos;s English
            </Text>
            <Text style={styles.playlistRowMeta} numberOfLines={1}>
              {unlocked
                ? lessonStatsLine(lesson, lessonIndex, isDone, displayDuration)
                : proLocked
                  ? `Unlock ${level.title} – ${unlockLabel} to play`
                  : 'Complete previous lesson to unlock'}
            </Text>

            {isActive && unlocked && (showReview || isDone) && (
              <TouchableOpacity
                style={styles.playlistCompleteBtn}
                onPress={onMarkComplete}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather
                  name="check-circle"
                  size={20}
                  color={isDone ? '#1A73E8' : '#5F6368'}
                />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playlistRowMenu}
          onPress={onMenu}
          disabled={!unlocked}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="more-vertical" size={20} color="#606060" />
        </TouchableOpacity>
      </View>

      {isActive && unlocked && isPlaying && !showReview && (
        <TouchableOpacity style={styles.playlistSummaryLink} onPress={onContinueToReview}>
          <Text style={styles.playlistSummaryLinkText}>
            Finished watching? View summary & PDF
          </Text>
        </TouchableOpacity>
      )}

      {isActive && unlocked && showReview && (
        <View style={styles.playlistReviewBlock}>
          <Text style={styles.reviewHeading}>About this lesson</Text>
          <Text style={styles.reviewDescription}>{lesson.description}</Text>

          <TouchableOpacity
            style={[styles.pdfDownloadBtn, isPdfDownloading && styles.pdfDownloadBtnBusy]}
            onPress={onDownloadPdf}
            activeOpacity={0.7}
            disabled={isPdfDownloading}
          >
            <View style={styles.pdfIconWrap}>
              <Image
                source={Icons3D.pdf}
                style={styles.pdfIconImage}
                resizeMode="contain"
              />
              <View style={styles.pdfIconBadge}>
                <Text style={styles.pdfIconBadgeText}>PDF</Text>
              </View>
            </View>
            <View style={styles.pdfDownloadTextWrap}>
              <Text style={styles.pdfDownloadTitle}>
                {isPdfDownloading ? 'Downloading…' : 'Download PDF'}
              </Text>
              <Text style={styles.pdfDownloadSub} numberOfLines={1}>
                {lesson.pdfTitle}
              </Text>
            </View>
            {isPdfDownloading ? (
              <ActivityIndicator size="small" color="#1A73E8" />
            ) : (
              <Feather name="download" size={20} color="#1A73E8" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roadmapPrimaryBtn, { backgroundColor: level.color[0] }]}
            onPress={onNextLesson}
          >
            <Text style={styles.roadmapPrimaryBtnText}>
              {lessonIndex < level.lessons.length - 1 ? 'Next lesson' : 'Finish level'}
            </Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ProLockBanner({
  level,
  unlockLabel,
  onBuyPro,
}: {
  level: AppCategory;
  unlockLabel: string;
  onBuyPro: () => void;
}) {
  return (
    <Pressable
      style={styles.proLockBanner}
      onPress={onBuyPro}
      android_ripple={{ color: 'rgba(230, 0, 0, 0.08)' }}
    >
      <View style={styles.proLockBannerTextWrap}>
        <Text style={styles.proLockBannerTitle}>{level.title} videos are locked</Text>
        <Text style={styles.proLockBannerSub}>
          Unlock {level.title} – {unlockLabel} to play
        </Text>
      </View>
      <View style={styles.proLockBannerBtn}>
        <Text style={styles.proLockBannerBtnText}>Unlock</Text>
      </View>
    </Pressable>
  );
}

function CoursePlaylistView({
  categories,
  level,
  levelUnlocked,
  proLocked,
  unlockLabel,
  onBuyPro,
  purchasingPro,
  completedLessons,
  focusIndex,
  playingLessonId,
  lessonReviewId,
  selectedLevel,
  onSelectLevel,
  isLevelUnlocked,
  detectedDurations,
  onPlay,
  onClosePlayer,
  onDownloadPdf,
  pdfDownloadingId = null,
  onNextLesson,
  onContinueToReview,
  onMarkComplete,
  renderPlayer,
  isFullscreen,
  refreshing,
  onRefresh,
}: {
  categories: AppCategory[];
  level: AppCategory;
  levelUnlocked: boolean;
  proLocked: boolean;
  unlockLabel: string;
  onBuyPro: () => void;
  purchasingPro: boolean;
  completedLessons: string[];
  focusIndex: number;
  playingLessonId: string | null;
  lessonReviewId: string | null;
  selectedLevel: string;
  onSelectLevel: (id: string) => void;
  isLevelUnlocked: (id: string) => boolean;
  detectedDurations: Record<string, string>;
  onPlay: (lessonId: string) => void;
  onClosePlayer: () => void;
  onDownloadPdf: (lesson: AppLesson) => void;
  pdfDownloadingId?: string | null;
  onNextLesson: (lessonId: string) => void;
  onContinueToReview: (lessonId: string) => void;
  onMarkComplete: (lessonId: string) => void;
  renderPlayer: (isFull: boolean) => React.ReactNode;
  isFullscreen: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const levelIcon = iconForLevel(level.id);
  const currentLesson = level.lessons[focusIndex] ?? level.lessons[0];
  const currentId = playingLessonId ?? currentLesson?.id;
  const currentIndex = level.lessons.findIndex((l) => l.id === currentId);
  const activeLesson = level.lessons[currentIndex >= 0 ? currentIndex : 0];
  const isPlaying = playingLessonId === activeLesson?.id && !isFullscreen;
  const canPlayInLevel = levelUnlocked && !proLocked;

  const openLessonMenu = (lesson: AppLesson, index: number) => {
    if (proLocked) {
      onBuyPro();
      return;
    }
    const unlocked = canPlayInLevel && isLessonUnlockedInRoadmap(level.lessons, index, completedLessons);
    if (!unlocked) return;
    const done = completedLessons.includes(lesson.id);
    Alert.alert(lesson.title, undefined, [
      { text: 'Play video', onPress: () => onPlay(lesson.id) },
      { text: 'Download PDF', onPress: () => onDownloadPdf(lesson) },
      {
        text: done ? 'Unmark complete' : 'Mark complete',
        onPress: () => onMarkComplete(lesson.id),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const inPlayerMode = !!playingLessonId && !proLocked;

  const playlistItems = useMemo(() => {
    const items = level.lessons.map((lesson, index) => ({ lesson, index }));
    if (!inPlayerMode) return items;
    const activeIdx = items.findIndex((item) => item.lesson.id === playingLessonId);
    if (activeIdx <= 0) return items;
    const reordered = [...items];
    const [current] = reordered.splice(activeIdx, 1);
    reordered.unshift(current);
    return reordered;
  }, [level.lessons, playingLessonId, inPlayerMode]);

  const renderPlaylistItem = ({
    item,
    index: displayIndex,
  }: {
    item: { lesson: AppLesson; index: number };
    index: number;
  }) => {
    const { lesson, index } = item;
    const roadmapOk = isLessonUnlockedInRoadmap(level.lessons, index, completedLessons);
    const unlocked = canPlayInLevel && roadmapOk;
    const isDone = completedLessons.includes(lesson.id);
    const isActive = !!playingLessonId && lesson.id === playingLessonId && !proLocked;
    const showReview = lessonReviewId === lesson.id && !proLocked;
    const durationLabel = detectedDurations[lesson.id];

    return (
      <View>
        {displayIndex === 1 && playingLessonId && !proLocked ? (
          <Text style={styles.playlistUpNextLabel}>Up next</Text>
        ) : null}
        <PlaylistLessonRow
          lesson={lesson}
          lessonIndex={index}
          level={level}
          unlocked={unlocked}
          proLocked={proLocked}
          unlockLabel={unlockLabel}
          isDone={isDone}
          isActive={isActive}
          isPlaying={isPlaying && isActive}
          showReview={showReview}
          durationLabel={durationLabel}
          onPlay={() => {
            if (proLocked) {
              onBuyPro();
              return;
            }
            onPlay(lesson.id);
          }}
          onMenu={() => openLessonMenu(lesson, index)}
          onDownloadPdf={() => onDownloadPdf(lesson)}
          isPdfDownloading={pdfDownloadingId === lesson.id}
          onNextLesson={() => onNextLesson(lesson.id)}
          onContinueToReview={() => onContinueToReview(lesson.id)}
          onMarkComplete={() => onMarkComplete(lesson.id)}
        />
      </View>
    );
  };

  return (
    <View
      style={[
        styles.playlistLayout,
        !inPlayerMode && styles.playlistLayoutList,
      ]}
    >
      {inPlayerMode && (
        <View style={[styles.playlistPlayerWrap, { height: PLAYLIST_PLAYER_HEIGHT }]}>
          {isFullscreen ? (
            <View style={styles.playlistPlayerPlaceholder} />
          ) : (
            renderPlayer(false)
          )}
        </View>
      )}

      <View
        style={[
          styles.playlistSheet,
          !inPlayerMode ? styles.playlistSheetFull : styles.playlistSheetPlayer,
        ]}
      >
        {!inPlayerMode ? (
          <View style={styles.levelTabsInSheet}>
            <CategoryTabs
              categories={categories}
              selected={selectedLevel}
              onSelect={onSelectLevel}
              isLevelUnlocked={isLevelUnlocked}
            />
          </View>
        ) : null}

        <View style={[styles.playlistSheetHeader, !inPlayerMode && styles.playlistSheetHeaderAfterTabs]}>
          <View style={[styles.playlistSheetIcon, { backgroundColor: `${level.color[0]}18` }]}>
            <MaterialCommunityIcons name={levelIcon} size={22} color={level.color[0]} />
          </View>
          <View style={styles.playlistSheetTitles}>
            <Text style={styles.playlistSheetTitle} numberOfLines={1}>
              {inPlayerMode ? `${level.title} — Now playing` : `${level.title} lessons`}
            </Text>
            <Text style={styles.playlistSheetSub} numberOfLines={2}>
              {proLocked
                ? `Videos locked. Unlock ${level.title} – ${unlockLabel} to play.`
                : inPlayerMode
                  ? `${level.subtitle}. Tap X to return to the lesson list.`
                  : `${level.subtitle}. Tap a lesson to watch.`}
            </Text>
          </View>
          {inPlayerMode ? (
            <TouchableOpacity
              style={styles.playlistCloseBtn}
              onPress={onClosePlayer}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={22} color="#1F1F1F" />
            </TouchableOpacity>
          ) : null}
        </View>

        {proLocked ? (
          <ProLockBanner level={level} unlockLabel={unlockLabel} onBuyPro={onBuyPro} />
        ) : null}

        <FlatList
          style={styles.playlistScroll}
          data={playlistItems}
          keyExtractor={(item) => item.lesson.id}
          renderItem={renderPlaylistItem}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={8}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={UI.accent} />
            ) : undefined
          }
          ItemSeparatorComponent={() => <View style={styles.playlistRowDivider} />}
        />
      </View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyCoursesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setHideTabBar } = useGameTabBar();

  useFocusEffect(
    useCallback(() => {
      setHideTabBar(true);
      return () => setHideTabBar(false);
    }, [setHideTabBar]),
  );

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [lastLessonId, setLastLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [refreshingCourses, setRefreshingCourses] = useState(false);
  const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [roadmapFocusIndex, setRoadmapFocusIndex] = useState(0);
  const [lessonReviewId, setLessonReviewId] = useState<string | null>(null);
  const [hasLockedPlans, setHasLockedPlans] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionAccess, setSubscriptionAccess] = useState<Record<string, boolean>>({});
  const [checkoutCategory, setCheckoutCategory] = useState<CategorySlug | null>(null);
  const [detectedDurations, setDetectedDurations] = useState<Record<string, string>>({});

  const [playingLessonId, setPlayingLessonId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const lastCoursesSigRef = useRef('');
  const firstCoursesLoadRef = useRef(true);

  const videoRef = useRef<Video>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressWidthRef = useRef(0);
  const lastUiTickRef = useRef(0);
  const savedPositionRef = useRef(0);
  const needsSeekOnLoadRef = useRef(false);
  const playingLessonIdRef = useRef<string | null>(null);
  playingLessonIdRef.current = playingLessonId;

  // Load local progress only — courses keep their own loader until the catalog arrives.
  useEffect(() => {
    const init = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        const [{ completedLessons: saved, lastLessonId: last }, cachedRaw] = await Promise.all([
          loadCourseProgress(),
          AsyncStorage.getItem(COURSES_CACHE_KEY),
        ]);
        setCompletedLessons(saved);
        if (last) setLastLessonId(last);

        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as {
              categories?: AppCategory[];
              plans?: SubscriptionPlan[];
              access?: Record<string, boolean>;
              hasLockedPlans?: boolean;
            };
            if (cached.categories?.length) {
              lastCoursesSigRef.current = coursesSignature(cached.categories);
              setCategories(cached.categories);
              if (cached.plans) setSubscriptionPlans(cached.plans);
              if (cached.access) setSubscriptionAccess(cached.access);
              setHasLockedPlans(Boolean(cached.hasLockedPlans));
              setSelectedCategory((prev) => prev || cached.categories[0]?.id || '');
              setLoading(false);
              contentOpacity.setValue(1);
            }
          } catch {
            /* ignore bad cache */
          }
        }
      } catch (e) {
        console.error('Failed to load progress', e);
      }
    };
    init();
  }, [contentOpacity]);

  const findLesson = useCallback(
    (lessonId: string | null): AppLesson | null => {
      if (!lessonId) return null;
      for (const cat of categories) {
        const lesson = cat.lessons.find((l) => l.id === lessonId);
        if (lesson) return lesson;
      }
      return null;
    },
    [categories],
  );

  const applySubscriptionLocks = useCallback(
    (mapped: AppCategory[], plans: SubscriptionPlan[] = subscriptionPlans): AppCategory[] =>
      mapped.map((c) => {
        const free = isCategoryFree(c.id, c.title, plans, c);
        const locked = free ? false : Boolean(c.locked);
        return {
          ...c,
          isPro: free ? false : c.isPro,
          locked,
          lessons: c.lessons.map((l) => ({
            ...l,
            videoUrl: locked ? null : l.videoUrl,
            pdfUrl: locked ? null : l.pdfUrl,
            locked,
          })),
        };
      }),
    [subscriptionPlans]
  );

  const loadServerCourses = useCallback(async () => {
    try {
      const sessionOk = await ensureValidSession();
      if (!sessionOk) {
        setCoursesError('Unable to refresh session. Check your connection and try again.');
        return;
      }

      setCoursesError(null);
      const [res, sub] = await Promise.all([
        apiFetch<{ data: ApiCourse[] }>('/api/courses'),
        fetchSubscription().catch(() => null),
      ]);
      if (sub?.plans) setSubscriptionPlans(sub.plans);
      if (sub?.access) setSubscriptionAccess(sub.access);

      const mapped = applySubscriptionLocks(
        mapApiCoursesToApp(res.data ?? []),
        sub?.plans || subscriptionPlans,
      );
      const lockedFromPlans = (sub?.plans || []).some(
        (p) => p.requiresPayment && !sub?.access?.[p.category]
      );
      const nextLocked = mapped.some((c) => c.locked) || lockedFromPlans;
      const nextSig = coursesSignature(mapped);

      if (nextSig !== lastCoursesSigRef.current) {
        lastCoursesSigRef.current = nextSig;
        setHasLockedPlans(nextLocked);
        setCategories(mapped);
        setSelectedCategory((prev) => {
          if (prev && mapped.some((c) => c.id === prev)) return prev;
          return mapped[0]?.id ?? '';
        });
      } else {
        // Always refresh media URLs even when list shape is unchanged
        setHasLockedPlans(nextLocked);
        setCategories(mapped);
      }

      void AsyncStorage.setItem(
        COURSES_CACHE_KEY,
        JSON.stringify({
          categories: mapped,
          plans: sub?.plans || subscriptionPlans,
          access: sub?.access || {},
          hasLockedPlans: nextLocked,
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load courses';
      if (/unable to refresh session|please sign in|session revoked|sign in again/i.test(message)) {
        setCoursesError(message);
        return;
      }
      console.warn('Failed to load courses', e);
      setCoursesError(message);
    } finally {
      if (firstCoursesLoadRef.current) {
        firstCoursesLoadRef.current = false;
        setLoading(false);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [applySubscriptionLocks, contentOpacity, subscriptionPlans]);

  const refreshCourses = useCallback(async () => {
    setRefreshingCourses(true);
    try {
      await loadServerCourses();
    } finally {
      setRefreshingCourses(false);
    }
  }, [loadServerCourses]);

  const handleBuyCategory = useCallback((levelId: string) => {
    const cat = categories.find((c) => c.id === levelId);
    const slug =
      asCategorySlug(levelId, cat?.title) ||
      asCategorySlug(
        categories.find((c) => c.locked)?.id || '',
        categories.find((c) => c.locked)?.title,
      ) ||
      (['intermediate', 'advanced'] as CategorySlug[]).find((key) =>
        subscriptionPlans.some((p) => p.category === key && p.requiresPayment && !subscriptionAccess[key]),
      ) ||
      null;
    if (!slug) return;
    const plan = subscriptionPlans.find((p) => p.category === slug);
    if (plan && !plan.requiresPayment) return;
    setCheckoutCategory(slug);
  }, [categories, subscriptionPlans, subscriptionAccess]);

  useFocusEffect(
    useCallback(() => {
      loadCourseProgress().then(({ completedLessons: saved, lastLessonId: last }) => {
        setCompletedLessons(saved);
        setLastLessonId(last);
      });

      // Refresh server-driven lesson media so admin uploads/deletes reflect quickly.
      loadServerCourses();
      const interval = setInterval(() => {
        void loadServerCourses();
      }, 15000);

      return () => clearInterval(interval);
    }, [loadServerCourses])
  );

  // Timer to hide controls
  const startHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isPaused) setControlsVisible(false);
    }, 3000);
  };

  const toggleControls = () => {
    if (controlsVisible) {
      setControlsVisible(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      setControlsVisible(true);
      if (!isPaused) startHideTimer();
    }
  };

  useEffect(() => {
    if (controlsVisible && !isPaused) {
      startHideTimer();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [controlsVisible, isPaused]);

  // Save progress
  const toggleCompletion = async (lessonId: string) => {
    const isCompleted = completedLessons.includes(lessonId);
    let newList: string[];
    let lastId = lastLessonId;
    if (isCompleted) {
      newList = completedLessons.filter((id) => id !== lessonId);
      try {
        await syncLessonToServer(lessonId, false);
      } catch (e) {
        console.error('Failed to sync lesson removal', e);
      }
    } else {
      newList = [...completedLessons, lessonId];
      lastId = lessonId;
      setLastLessonId(lessonId);
      try {
        await syncLessonToServer(lessonId, true);
      } catch (e) {
        console.error('Failed to sync lesson completion', e);
      }
    }
    setCompletedLessons(newList);
    await saveCourseProgress(newList, lastId);
  };

  const markLessonComplete = useCallback(
    async (lessonId: string) => {
      if (completedLessons.includes(lessonId)) {
        setLastLessonId(lessonId);
        return;
      }
      const newList = [...completedLessons, lessonId];
      setCompletedLessons(newList);
      setLastLessonId(lessonId);
      await saveCourseProgress(newList, lessonId);
      try {
        await syncLessonToServer(lessonId, true);
      } catch (e) {
        console.error('Failed to sync lesson completion', e);
      }
    },
    [completedLessons]
  );

  const isCategoryProLocked = useCallback(
    (levelId: string) => {
      const cat = categories.find((c) => c.id === levelId);
      if (isCategoryFree(levelId, cat?.title, subscriptionPlans, cat)) return false;
      const slug = asCategorySlug(levelId, cat?.title);
      if (cat?.locked) return true;
      if (!slug) return false;
      const plan = subscriptionPlans.find((p) => p.category === slug);
      if (plan?.requiresPayment && subscriptionAccess[slug] === false) return true;
      return false;
    },
    [categories, subscriptionPlans, subscriptionAccess]
  );

  const isLevelUnlockedForUser = (levelId: string) => {
    const cat = categories.find((c) => c.id === levelId);
    if (isCategoryFree(levelId, cat?.title, subscriptionPlans, cat)) return true;
    if (isCategoryProLocked(levelId) || cat?.locked) return false;
    return isLevelUnlocked(levelId, completedLessons, categories);
  };

  const unlockLabelFor = useCallback(
    (levelId: string) => priceLabelForCategory(levelId, subscriptionPlans),
    [subscriptionPlans]
  );

  const getLessonLevelId = (lessonId: string): string | null => {
    for (const level of categories) {
      if (level.lessons.some((l) => l.id === lessonId)) return level.id;
    }
    return null;
  };

  const getVideoSourceForLesson = (lessonId: string | null) => {
    const lesson = findLesson(lessonId);
    if (!lesson || lesson.locked) return null;
    const levelId = getLessonLevelId(lessonId || '');
    if (levelId && isCategoryProLocked(levelId)) return null;
    const uri = resolveMediaUrl(lesson.videoUrl);
    if (!uri) return null;
    return {
      uri,
      overrideFileExtensionAndroid: 'mp4' as const,
    };
  };

  const pauseVideo = useCallback(() => {
    videoRef.current?.pauseAsync().catch(() => { });
  }, []);

  const playVideo = useCallback(() => {
    videoRef.current?.playAsync().catch(() => { });
  }, []);

  const lockPortraitOrientation = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      try {
        await ScreenOrientation.unlockAsync();
      } catch {
        /* ignore */
      }
    }
    setIsLandscape(false);
  }, []);

  const lockLandscapeOrientation = useCallback(async () => {
    await ScreenOrientation.unlockAsync();
    const lock = ScreenOrientation.OrientationLock.LANDSCAPE;
    const supported = await ScreenOrientation.supportsOrientationLockAsync(lock);
    await ScreenOrientation.lockAsync(
      supported ? lock : ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
    );
    setIsLandscape(true);
  }, []);

  const closePlayer = useCallback(() => {
    pauseVideo();
    setPlayingLessonId(null);
    setIsFullscreen(false);
    setIsPaused(true);
    setIsVideoLoaded(false);
    setControlsVisible(true);
    lockPortraitOrientation();
  }, [pauseVideo, lockPortraitOrientation]);

  const syncRoadmapFocus = useCallback((levelId: string, completed: string[]) => {
    const level = categories.find((l) => l.id === levelId);
    if (!level) return;
    const firstIncomplete = level.lessons.findIndex((l) => !completed.includes(l.id));
    setRoadmapFocusIndex(firstIncomplete >= 0 ? firstIncomplete : level.lessons.length - 1);
  }, [categories]);

  useEffect(() => {
    if (!loading && selectedCategory) syncRoadmapFocus(selectedCategory, completedLessons);
  }, [loading, selectedCategory, completedLessons, syncRoadmapFocus]);

  const handleSelectCategory = useCallback((id: string) => {
    setSelectedCategory(id);
    setLessonReviewId(null);
    syncRoadmapFocus(id, completedLessons);
    pauseVideo();
    setPlayingLessonId(null);
    setIsFullscreen(false);
    setIsPaused(true);
    setIsVideoLoaded(false);
    setControlsVisible(true);
    setCurrentTime(0);
    setDuration(0);
    if (isCategoryProLocked(id)) handleBuyCategory(id);
  }, [pauseVideo, completedLessons, syncRoadmapFocus, isCategoryProLocked, handleBuyCategory]);

  const refreshLessonMedia = useCallback(async (lessonId: string) => {
    const sessionOk = await ensureValidSession();
    if (!sessionOk) return null;
    const [res, sub] = await Promise.all([
      apiFetch<{ data: ApiCourse[] }>('/api/courses'),
      fetchSubscription().catch(() => null),
    ]);
    if (sub?.plans) setSubscriptionPlans(sub.plans);
    if (sub?.access) setSubscriptionAccess(sub.access);
    const mapped = applySubscriptionLocks(
      mapApiCoursesToApp(res.data ?? []),
      sub?.plans || subscriptionPlans,
    );
    lastCoursesSigRef.current = coursesSignature(mapped);
    setCategories(mapped);
    return mapped.flatMap((c) => c.lessons).find((l) => l.id === lessonId) || null;
  }, [applySubscriptionLocks, subscriptionPlans]);

  const handleDownloadPdf = useCallback(async (lesson: AppLesson) => {
    const level = categories.find((l) => l.lessons.some((x) => x.id === lesson.id));
    if (level && isCategoryProLocked(level.id)) {
      handleBuyCategory(level.id);
      return;
    }
    if (lesson.pdfAvailableIn && lesson.pdfAvailableIn > 0) {
      Alert.alert(
        'PDF processing',
        `This PDF will be ready in about ${lesson.pdfAvailableIn} seconds. Pull down to refresh My Courses.`
      );
      return;
    }

    let pdfUrl = lesson.pdfUrl;
    if (!pdfUrl) {
      try {
        const fresh = await refreshLessonMedia(lesson.id);
        pdfUrl = fresh?.pdfUrl || null;
      } catch {
        /* ignore */
      }
    }
    if (!pdfUrl) {
      Alert.alert(
        'PDF unavailable',
        'This PDF is not on the server yet. Ask admin to re-upload it from the dashboard, then pull down to refresh.'
      );
      return;
    }

    setPdfDownloadingId(lesson.id);
    try {
      const result = await downloadLessonPdf(pdfUrl, lesson.pdfTitle || lesson.title);
      Alert.alert(
        'PDF downloaded',
        `Saved to your ${result.locationLabel}.\n\nOpen your phone Downloads / Files app to view it.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not download PDF';
      Alert.alert('Download failed', message);
    } finally {
      setPdfDownloadingId(null);
    }
  }, [categories, isCategoryProLocked, handleBuyCategory, refreshLessonMedia]);

  const handleContinueToReview = useCallback((lessonId: string) => {
    pauseVideo();
    setIsPaused(true);
    setLessonReviewId(lessonId);
    setControlsVisible(true);
  }, [pauseVideo]);

  const activeLevel = categories.find((l) => l.id === selectedCategory) ?? categories[0];
  const totalLessons = totalLessonCount(categories);

  const renderHeader = () => (
    <View style={[styles.screenHeader, { paddingTop: insets.top }]}>
      <View style={styles.screenHeaderRow}>
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)')}
          style={styles.screenBackBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={24} color={UI.text} />
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle} numberOfLines={1}>
          My Courses
        </Text>
        {!loading ? (
          <View style={styles.screenProgressPill}>
            <Text style={styles.screenProgressPillText}>
              {completedLessons.length}/{totalLessons}
            </Text>
          </View>
        ) : (
          <View style={styles.screenHeaderSpacer} />
        )}
        {!loading && hasLockedPlans ? (
          <TouchableOpacity
            style={styles.premiumHeaderBtn}
            onPress={() => handleBuyCategory(activeLevel?.id || selectedCategory)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Upgrade"
          >
            <Text style={styles.premiumHeaderBtnText}>Upgrade</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const handlePlay = async (lessonId: string) => {
    const lessonLevel = categories.find((l) => l.lessons.some((x) => x.id === lessonId));
    if (!lessonLevel) return;

    if (isCategoryProLocked(lessonLevel.id) || lessonLevel.locked) {
      closePlayer();
      handleBuyCategory(lessonLevel.id);
      return;
    }

    let lesson = lessonLevel.lessons.find((l) => l.id === lessonId);
    if (!lesson?.videoUrl) {
      if (lessonLevel.locked || isCategoryProLocked(lessonLevel.id)) {
        handleBuyCategory(lessonLevel.id);
        return;
      }
      if (lesson?.videoAvailableIn && lesson.videoAvailableIn > 0) {
        Alert.alert(
          'Video processing',
          `This video will be ready in about ${lesson.videoAvailableIn} seconds. Pull down to refresh My Courses.`
        );
        return;
      }
      try {
        const fresh = await refreshLessonMedia(lessonId);
        if (fresh?.videoUrl) {
          lesson = fresh;
        }
      } catch {
        /* ignore */
      }
      if (!lesson?.videoUrl) {
        Alert.alert(
          'Video unavailable',
          'This video is not on the server yet. Ask admin to re-upload it from the dashboard, then pull down to refresh My Courses.'
        );
        return;
      }
    }

    saveCourseProgress(completedLessons, lessonId);
    setLastLessonId(lessonId);

    if (lessonId === playingLessonId) {
      closePlayer();
      return;
    }

    const levelId = getLessonLevelId(lessonId);
    if (levelId) setSelectedCategory(levelId);

    setLessonReviewId(null);
    const idx = lessonLevel.lessons.findIndex((l) => l.id === lessonId);
    if (idx >= 0) setRoadmapFocusIndex(idx);

    setPlayingLessonId(lessonId);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setIsVideoLoaded(false);
    setIsBuffering(true);
    setControlsVisible(true);
  };

  const handleNextLesson = useCallback(async (lessonId: string) => {
    const level = categories.find((l) => l.lessons.some((lesson) => lesson.id === lessonId));
    if (!level) return;

    if (isCategoryProLocked(level.id)) {
      closePlayer();
      handleBuyCategory(level.id);
      return;
    }

    await markLessonComplete(lessonId);
    setLessonReviewId(null);

    const currentIndex = level.lessons.findIndex((l) => l.id === lessonId);
    if (currentIndex < level.lessons.length - 1) {
      const nextLesson = level.lessons[currentIndex + 1];
      if (!nextLesson.videoUrl) {
        closePlayer();
        return;
      }
      setRoadmapFocusIndex(currentIndex + 1);
      const newList = completedLessons.includes(lessonId)
        ? completedLessons
        : [...completedLessons, lessonId];
      await saveCourseProgress(newList, nextLesson.id);
      setLastLessonId(nextLesson.id);
      setPlayingLessonId(nextLesson.id);
      setIsPaused(false);
      setCurrentTime(0);
      setDuration(0);
      setIsVideoLoaded(false);
      setIsBuffering(true);
      setControlsVisible(true);
    } else {
      closePlayer();
    }
  }, [markLessonComplete, closePlayer, categories, completedLessons, isCategoryProLocked, handleBuyCategory]);

  const togglePlayPause = () => {
    if (!playingLessonId) return;

    if (isPaused) {
      setIsPaused(false);
      setControlsVisible(true);
      playVideo();
      startHideTimer();
    } else {
      setIsPaused(true);
      pauseVideo();
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  };

  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if (!status.isLoaded) {
      if (status.error) setIsBuffering(false);
      return;
    }

    if (!isVideoLoaded) setIsVideoLoaded(true);

    if (needsSeekOnLoadRef.current) {
      needsSeekOnLoadRef.current = false;
      videoRef.current?.setPositionAsync(savedPositionRef.current).catch(() => { });
      if (!isPaused) playVideo();
    }

    setIsBuffering((prev) => (prev === status.isBuffering ? prev : status.isBuffering));

    if (status.durationMillis) {
      const totalSec = status.durationMillis / 1000;
      setDuration(totalSec);
      const lessonId = playingLessonIdRef.current;
      if (lessonId) {
        const label = formatDurationLabel(totalSec);
        setDetectedDurations((prev) =>
          prev[lessonId] === label ? prev : { ...prev, [lessonId]: label }
        );
      }
    }

    const now = Date.now();
    if (now - lastUiTickRef.current >= 450) {
      lastUiTickRef.current = now;
      setCurrentTime(status.positionMillis / 1000);
    }

    if (status.didJustFinish && playingLessonIdRef.current) {
      setIsPaused(true);
      setControlsVisible(true);
      pauseVideo();
      setLessonReviewId(playingLessonIdRef.current);
    }
  }, [isVideoLoaded, isPaused, pauseVideo, playVideo]);

  const openFullscreen = useCallback(() => {
    ScreenOrientation.unlockAsync().catch(() => { });
    videoRef.current?.getStatusAsync().then((s) => {
      if (s.isLoaded && 'positionMillis' in s) {
        savedPositionRef.current = s.positionMillis;
      }
      needsSeekOnLoadRef.current = true;
      setIsFullscreen(true);
    }).catch(() => setIsFullscreen(true));
  }, []);

  const closeFullscreen = useCallback(() => {
    videoRef.current?.getStatusAsync().then((s) => {
      if (s.isLoaded && 'positionMillis' in s) {
        savedPositionRef.current = s.positionMillis;
      }
      needsSeekOnLoadRef.current = true;
      setIsFullscreen(false);
      lockPortraitOrientation();
    }).catch(() => {
      setIsFullscreen(false);
      lockPortraitOrientation();
    });
  }, [lockPortraitOrientation]);

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, seconds));
    setCurrentTime(clamped);
    videoRef.current?.setPositionAsync(clamped * 1000).catch(() => { });
    startHideTimer();
  }, [duration]);

  const handleSkip = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  const handleSeekPress = (locationX: number) => {
    const w = progressWidthRef.current;
    if (!w || !duration) return;
    const ratio = Math.max(0, Math.min(1, locationX / w));
    seekTo(ratio * duration);
  };

  const formatTime = (seconds: number) => formatDurationLabel(seconds);

  const toggleRotation = useCallback(async () => {
    try {
      if (isLandscape) {
        await lockPortraitOrientation();
      } else {
        await lockLandscapeOrientation();
      }
    } catch (e) {
      console.warn('Video rotation failed', e);
    }
  }, [isLandscape, lockPortraitOrientation, lockLandscapeOrientation]);

  useEffect(() => {
    if (playingLessonId && !isPaused) {
      void activateKeepAwakeAsync('ohms-lesson-video');
      return () => {
        void deactivateKeepAwake('ohms-lesson-video');
      };
    }
    void deactivateKeepAwake('ohms-lesson-video');
  }, [playingLessonId, isPaused]);

  useEffect(() => {
    if (!isFullscreen && isLandscape) {
      lockPortraitOrientation();
    }
  }, [isFullscreen, isLandscape, lockPortraitOrientation]);

  useEffect(() => {
    return () => {
      lockPortraitOrientation();
    };
  }, [lockPortraitOrientation]);

  const renderPlayer = (isFull: boolean = false) => {
    const lesson = findLesson(playingLessonId);
    if (!lesson) return null;

    const videoSource = getVideoSourceForLesson(playingLessonId);
    const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const showCenterControls = controlsVisible || !isVideoLoaded;
    const cinemaMode = isPaused && !controlsVisible && isVideoLoaded;

    if (!videoSource) {
      const levelId = playingLessonId ? getLessonLevelId(playingLessonId) : null;
      const locked = (levelId && isCategoryProLocked(levelId)) || lesson.locked;
      const msg = locked
        ? `Unlock this category – ${unlockLabelFor(levelId || '')} to play this video.`
        : lesson.videoAvailableIn && lesson.videoAvailableIn > 0
          ? `Video will be available soon (~${lesson.videoAvailableIn}s)`
          : 'Video not available yet. Ask admin to upload from the dashboard.';

      return (
        <View style={isFull ? styles.fullPlayerContainer : styles.playlistPlayerVideoWrap}>
          <View style={styles.playerLoading}>
            <Feather name={locked ? 'lock' : 'video-off'} size={28} color="#fff" style={{ marginBottom: 10 }} />
            <Text style={styles.playerLoadingText}>{msg}</Text>
            {locked ? (
              <TouchableOpacity
                style={styles.playerUnlockBtn}
                onPress={() => handleBuyCategory(levelId || selectedCategory)}
                activeOpacity={0.85}
              >
                <Image source={Icons3D.crown} style={styles.playerUnlockBtnIcon} resizeMode="contain" />
                <Text style={styles.playerUnlockBtnText}>Unlock</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={isFull ? styles.fullPlayerContainer : styles.playlistPlayerVideoWrap}>
        <Video
          key={playingLessonId ?? 'video'}
          ref={videoRef}
          source={videoSource}
          style={isFull ? styles.fullThumbnail : styles.playlistPlayerVideo}
          resizeMode={isFull ? ResizeMode.CONTAIN : ResizeMode.COVER}
          shouldPlay={!isPaused}
          isMuted={isMuted}
          isLooping={false}
          useNativeControls={false}
          progressUpdateIntervalMillis={250}
          preferredForwardBufferDuration={45}
          onReadyForDisplay={() => setIsVideoLoaded(true)}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />

        {!isVideoLoaded && (
          <View style={styles.playerLoading} pointerEvents="none">
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {isBuffering && isVideoLoaded && !isPaused && !cinemaMode && (
          <View style={styles.playerBuffering} pointerEvents="none">
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.playerBufferingText}>Buffering…</Text>
          </View>
        )}

        {!showCenterControls && !isPaused && !cinemaMode && (
          <View style={styles.playerMiniProgress} pointerEvents="none">
            <View style={[styles.playerMiniProgressFill, { width: `${progressPct}%` }]} />
          </View>
        )}

        <Pressable style={styles.playerTapArea} onPress={toggleControls}>
          {showCenterControls && (
            <>
              <LinearGradient
                colors={['rgba(0,0,0,0.7)', 'transparent']}
                style={styles.playerGradientTop}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                style={styles.playerGradientBottom}
                pointerEvents="none"
              />

              <View style={styles.playerControls} pointerEvents="box-none">
                <View style={styles.playerTopRow}>
                  <TouchableOpacity
                    style={[styles.playerIconCircle, isFull && styles.playerIconCircleFull]}
                    onPress={() => (isFull ? closeFullscreen() : closePlayer())}
                  >
                    <Feather
                      name={isFull ? 'minimize-2' : 'chevron-down'}
                      size={isFull ? 20 : 16}
                      color="#fff"
                    />
                  </TouchableOpacity>
                  <Text style={[styles.playerTitle, isFull && styles.playerTitleFull]} numberOfLines={1}>
                    {lesson.title}
                  </Text>
                  <TouchableOpacity
                    style={[styles.playerIconCircle, isFull && styles.playerIconCircleFull]}
                    onPress={() => (isFull ? closeFullscreen() : openFullscreen())}
                  >
                    <MaterialCommunityIcons
                      name={isFull ? 'fullscreen-exit' : 'fullscreen'}
                      size={isFull ? 18 : 15}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                <View style={[styles.inlineCenterRow, isFull && styles.fullCenterRow]}>
                  <TouchableOpacity
                    style={[styles.skipBtnWrap, isFull && styles.skipBtnWrapFull]}
                    onPress={() => handleSkip(-10)}
                  >
                    <MaterialCommunityIcons
                      name="rewind-10"
                      size={isFull ? 28 : 20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playPauseBtn, isFull && styles.fullPlayPauseBtn]}
                    onPress={() => togglePlayPause()}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={isPaused ? 'play' : 'pause'}
                      size={isFull ? 34 : 22}
                      color="#1F1F1F"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.skipBtnWrap, isFull && styles.skipBtnWrapFull]}
                    onPress={() => handleSkip(10)}
                  >
                    <MaterialCommunityIcons
                      name="fast-forward-10"
                      size={isFull ? 28 : 20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inlineBottomRow}>
                  <Pressable
                    style={styles.timelineHit}
                    onLayout={(e) => {
                      progressWidthRef.current = e.nativeEvent.layout.width;
                    }}
                    onPress={(e) => handleSeekPress(e.nativeEvent.locationX)}
                  >
                    <View style={styles.inlineProgressBg}>
                      <View style={[styles.inlineProgressFill, { width: `${progressPct}%` }]} />
                      <View style={[styles.scrubberDot, { left: `${progressPct}%` }]} />
                    </View>
                  </Pressable>
                  <View style={styles.playerActionsRow}>
                    <Text style={[styles.inlineTime, isFull && styles.fullTime]}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Text>
                    <View style={styles.rightPlayerActions}>
                      {isFull && (
                        <TouchableOpacity
                          style={[styles.playerIconCircle, styles.playerIconCircleFull]}
                          onPress={toggleRotation}
                        >
                          <MaterialCommunityIcons name="screen-rotation" size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.playerIconCircle, isFull && styles.playerIconCircleFull]}
                        onPress={() => setIsMuted(!isMuted)}
                      >
                        <Ionicons
                          name={isMuted ? 'volume-mute' : 'volume-high'}
                          size={isFull ? 16 : 14}
                          color="#fff"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />
      {renderHeader()}

      {loading && categories.length === 0 ? (
        <CoursesLoadingSkeleton />
      ) : !activeLevel ? (
        <View style={styles.loadingBox}>
          <Text style={{ color: UI.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>
            {coursesError || 'No courses yet. Add categories and lessons from the admin dashboard.'}
          </Text>
        </View>
      ) : (
        <Animated.View style={[styles.mainColumn, { paddingBottom: insets.bottom, opacity: contentOpacity }]}>
          <CoursePlaylistView
            categories={categories}
            level={activeLevel}
            levelUnlocked={isLevelUnlockedForUser(activeLevel.id)}
            proLocked={isCategoryProLocked(activeLevel.id)}
            unlockLabel={unlockLabelFor(activeLevel.id)}
            onBuyPro={() => handleBuyCategory(activeLevel.id)}
            purchasingPro={false}
            completedLessons={completedLessons}
            focusIndex={roadmapFocusIndex}
            playingLessonId={playingLessonId}
            lessonReviewId={lessonReviewId}
            selectedLevel={selectedCategory}
            onSelectLevel={handleSelectCategory}
            isLevelUnlocked={isLevelUnlockedForUser}
            detectedDurations={detectedDurations}
            onPlay={handlePlay}
            onClosePlayer={closePlayer}
            onDownloadPdf={handleDownloadPdf}
            pdfDownloadingId={pdfDownloadingId}
            onNextLesson={handleNextLesson}
            onContinueToReview={handleContinueToReview}
            onMarkComplete={toggleCompletion}
            renderPlayer={renderPlayer}
            isFullscreen={isFullscreen}
            refreshing={refreshingCourses}
            onRefresh={refreshCourses}
          />
        </Animated.View>
      )}

      <Modal
        visible={isFullscreen && !!playingLessonId}
        animationType="fade"
        onRequestClose={closeFullscreen}
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <View
          style={[
            styles.fullscreenModalContainer,
            isLandscape ? styles.fullscreenModalLandscape : null,
            !isLandscape && { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <StatusBar barStyle="light-content" backgroundColor="#000" hidden={isLandscape} />
          {playingLessonId ? renderPlayer(true) : null}
        </View>
      </Modal>

      <SubscriptionCheckoutModal
        visible={checkoutCategory != null}
        category={checkoutCategory}
        onClose={() => setCheckoutCategory(null)}
        onPurchased={() => {
          void loadServerCourses();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },
  screenHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: UI.bg,
  },
  screenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  screenHeaderSpacer: {
    width: 44,
  },
  screenBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: UI.surface,
    ...headerShadow,
  },
  screenHeaderTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.4,
  },
  screenProgressPill: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 44,
    alignItems: 'center',
  },
  screenProgressPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.accent,
  },
  premiumHeaderBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minHeight: 32,
  },
  premiumHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.accent,
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: UI.bg },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: UI.bg,
  },
  skeletonBlock: {
    backgroundColor: '#E5E7EB',
  },
  skeletonTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
  },
  skeletonTab: {
    flex: 1,
    height: 36,
    borderRadius: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
    paddingLeft: 8,
  },
  skeletonThumb: {
    width: 120,
    height: 68,
    borderRadius: 8,
  },
  skeletonTextCol: {
    flex: 1,
    paddingTop: 4,
    gap: 8,
  },
  skeletonTitle: {
    height: 14,
    width: '88%',
    borderRadius: 6,
  },
  skeletonLine: {
    height: 12,
    width: '42%',
    borderRadius: 6,
  },
  skeletonMeta: {
    height: 12,
    width: '68%',
    borderRadius: 6,
  },
  scrollBody: { flex: 1 },
  mainColumn: { flex: 1, backgroundColor: UI.bg },
  levelTabsInSheet: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: UI.bg,
  },
  playlistSheetHeaderAfterTabs: {
    paddingTop: 4,
    borderTopWidth: 0,
  },
  playlistLayout: {
    flex: 1,
    backgroundColor: '#000',
  },
  playlistLayoutList: {
    backgroundColor: UI.bg,
  },
  playlistPlayerWrap: {
    width: '100%',
    backgroundColor: '#000',
  },
  playlistPlayerVideoWrap: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  playlistPlayerVideo: {
    width: '100%',
    height: '100%',
  },
  playlistPlayerPlaceholder: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFrameFallback: {
    backgroundColor: '#1a1a1a',
  },
  playlistPlayerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playlistPlayerPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  playlistSheet: {
    flex: 1,
    backgroundColor: UI.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -12,
  },
  playlistSheetFull: {
    marginTop: 0,
    backgroundColor: UI.bg,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  playlistSheetPlayer: {
    backgroundColor: UI.surface,
  },
  playlistSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: UI.bg,
  },
  playlistSheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistSheetTitles: { flex: 1, minWidth: 0 },
  playlistSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  playlistSheetSub: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 4,
    lineHeight: 17,
  },
  playlistCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistScroll: { flex: 1 },
  playlistUpNextLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F0F0F',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  playlistRowWrap: {
    backgroundColor: UI.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
  },
  playlistRowWrapActive: {
    backgroundColor: '#FFF8F8',
  },
  playlistRowDivider: {
    height: 0,
    marginLeft: 148,
  },
  playlistSummaryLink: {
    marginTop: 4,
    marginHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  playlistSummaryLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A73E8',
  },
  playlistReviewBlock: {
    marginTop: 4,
    marginHorizontal: 16,
    paddingBottom: 14,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 4,
    paddingVertical: 10,
  },
  playlistRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
    gap: 10,
    minWidth: 0,
  },
  playlistDragHandle: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 26,
    gap: 3,
  },
  playlistDragLine: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#C4C4C4',
  },
  playlistNowPlayingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 15, 15, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playlistCompleteBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    padding: 2,
  },
  playlistCompleteThumbBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#1A73E8',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistThumbWrap: {
    width: 120,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E8EAED',
    position: 'relative',
  },
  playlistThumb: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  playlistThumbLock: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistThumbDuration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playlistRowText: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
    paddingRight: 4,
  },
  playlistRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F0F',
    lineHeight: 19,
    paddingRight: 4,
  },
  playlistRowChannel: {
    fontSize: 12,
    color: '#606060',
    marginTop: 4,
  },
  playlistRowMeta: {
    fontSize: 12,
    color: '#606060',
    marginTop: 2,
  },
  playlistRowMenu: {
    padding: 8,
    marginTop: 2,
    marginRight: 4,
  },
  sectionHeader: { paddingTop: 2, paddingBottom: 0, marginBottom: 8 },
  sectionHeaderInset: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 0 },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6368',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionHeaderLine: { height: 1, backgroundColor: '#E8EAED', marginBottom: 6 },
  sectionHeaderLineInset: { marginBottom: 4 },
  categorySection: { marginBottom: 0 },
  categoryRow: {
    flexDirection: 'row',
    gap: 5,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: UI.surface,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 36,
  },
  categoryBtnActive: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  categoryBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F6368',
    textAlign: 'center',
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  categoryBtnLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryBtnLabelLocked: {
    color: '#9AA0A6',
  },
  levelSection: { marginBottom: 16 },
  levelBadge: {
    fontSize: 12,
    color: '#5F6368',
    flex: 1,
    textAlign: 'right',
    marginRight: 4,
  },
  roadmapStep: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  roadmapTimeline: {
    width: 40,
    alignItems: 'center',
  },
  roadmapDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E8EAED',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  roadmapDotActive: {
    borderWidth: 2.5,
    backgroundColor: '#FAFBFF',
  },
  roadmapDotDone: {
    backgroundColor: '#34A853',
    borderColor: '#34A853',
  },
  roadmapDotLocked: {
    backgroundColor: '#F1F3F4',
    borderColor: '#E8EAED',
  },
  roadmapDotNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5F6368',
  },
  roadmapLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: '#E8EAED',
    marginVertical: 4,
  },
  roadmapContent: {
    flex: 1,
    paddingBottom: 16,
    paddingTop: 4,
    minWidth: 0,
  },
  roadmapStepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  roadmapStepTitleLocked: {
    color: '#9AA0A6',
  },
  roadmapStepMeta: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
  },
  roadmapActiveCard: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EAED',
    backgroundColor: '#FAFBFF',
  },
  roadmapPlayTap: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  proLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
  },
  proLockBannerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  proLockBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI.text,
  },
  proLockBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.accent,
    marginTop: 3,
  },
  proLockBannerBtn: {
    backgroundColor: UI.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  proLockBannerBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  roadmapPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  roadmapPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#E8F0FE',
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
  },
  reviewPromptText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1A73E8',
  },
  reviewPanel: {
    padding: 14,
  },
  reviewDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  reviewDoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34A853',
  },
  reviewHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  reviewDescription: {
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 22,
    marginBottom: 14,
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    marginBottom: 14,
  },
  pdfDownloadBtnBusy: {
    opacity: 0.75,
  },
  pdfIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pdfIconImage: {
    width: 36,
    height: 36,
  },
  pdfIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#E53935',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pdfIconBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pdfDownloadTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  pdfDownloadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  pdfDownloadSub: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
  },
  levelListCard: {
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
  levelCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    paddingBottom: 8,
  },
  levelIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelHeaderText: { flex: 1, minWidth: 0 },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  levelSubtitle: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 2,
    lineHeight: 18,
  },
  levelProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  miniProgressBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', borderRadius: 2 },
  lessonDivider: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginHorizontal: 16,
  },
  lessonCard: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  lessonCardDone: {
    backgroundColor: '#F8FBF9',
  },
  lessonCardPlaying: {
    backgroundColor: '#FAFBFF',
    borderLeftWidth: 3,
    borderLeftColor: '#1A73E8',
  },
  inlinePlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  playerTapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  playerLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
    gap: 10,
  },
  playerLoadingText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  playerUnlockBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  playerUnlockBtnIcon: {
    width: 16,
    height: 16,
  },
  playerUnlockBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  playerBuffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    gap: 8,
  },
  playerBufferingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  playerMiniProgress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 3,
  },
  playerMiniProgressFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
  },
  playerGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  playerGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  playerControls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  playerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playerTitleFull: {
    fontSize: 14,
  },
  playerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerIconCircleFull: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  inlineCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  skipBtnWrap: {
    padding: 4,
    opacity: 0.95,
  },
  skipBtnWrapFull: {
    padding: 6,
  },
  playPauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
  },
  inlineBottomRow: {
    width: '100%',
    paddingBottom: 4,
  },
  timelineHit: {
    width: '100%',
    height: 22,
    justifyContent: 'center',
    marginBottom: 2,
  },
  inlineProgressBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    width: '100%',
    borderRadius: 2,
    position: 'relative',
  },
  inlineProgressFill: {
    height: '100%',
    backgroundColor: '#1A73E8',
    borderRadius: 2,
  },
  scrubberDot: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
    marginLeft: -5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  thumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  fullscreenPlayingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26,115,232,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fullscreenPlayingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  playerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -2,
  },
  inlineTime: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rightPlayerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#34A853',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  lessonInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F1F1F',
    lineHeight: 20,
  },
  lessonMeta: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 4,
  },
  lessonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F4',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  completeToggleActive: {
    backgroundColor: '#34A853',
  },
  completeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5F6368',
  },
  completeTextActive: {
    color: '#FFFFFF',
  },
  // Fullscreen Styles
  fullscreenModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullscreenModalLandscape: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  fullPlayerContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullThumbnail: {
    width: '100%',
    height: '100%',
  },
  fullCenterRow: {
    gap: 40,
  },
  fullPlayPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    paddingLeft: 3,
  },
  fullTime: {
    fontSize: 12,
  },
});