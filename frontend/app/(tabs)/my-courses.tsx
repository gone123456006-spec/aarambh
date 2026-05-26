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
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as WebBrowser from 'expo-web-browser';
import {
  COURSE_DATA,
  LECTURE_VIDEO,
  LEVEL_ICONS,
  LevelId,
  Lesson,
  SAMPLE_PDF_URL,
} from '@/constants/courseData';
import {
  isLevelUnlocked,
  loadCourseProgress,
  saveCourseProgress,
  syncLessonToServer,
} from '@/utils/courseProgress';
import { useFocusEffect } from 'expo-router';
const SCREEN_WIDTH = Dimensions.get('window').width;
const PLAYLIST_PLAYER_HEIGHT = SCREEN_WIDTH * (9 / 16);

function isLessonUnlockedInRoadmap(
  lessons: Lesson[],
  index: number,
  completedLessons: string[],
) {
  if (index === 0) return true;
  return completedLessons.includes(lessons[index - 1].id);
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
  selected,
  onSelect,
  isLevelUnlocked,
}: {
  selected: LevelId;
  onSelect: (id: LevelId) => void;
  isLevelUnlocked: (id: LevelId) => boolean;
}) {
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryRow}>
        {COURSE_DATA.map((level) => {
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
                !unlocked && styles.categoryBtnLocked,
              ]}
              onPress={() => onSelect(level.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryBtnLabel,
                  active && styles.categoryBtnLabelActive,
                  !unlocked && !active && styles.categoryBtnLabelLocked,
                ]}
                numberOfLines={1}
              >
                {level.title}
              </Text>
              {!unlocked && (
                <Feather
                  name="lock"
                  size={9}
                  color={active ? 'rgba(255,255,255,0.9)' : '#9AA0A6'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function lessonStatsLine(lesson: Lesson, index: number, isDone: boolean) {
  const parts = [`Lesson ${index + 1}`, lesson.duration];
  if (isDone) parts.push('Completed');
  return parts.join(' · ');
}

function PlaylistLessonRow({
  lesson,
  lessonIndex,
  level,
  unlocked,
  isDone,
  isActive,
  isPlaying,
  showReview,
  onPlay,
  onMenu,
  onDownloadPdf,
  onNextLesson,
  onContinueToReview,
  onMarkComplete,
}: {
  lesson: Lesson;
  lessonIndex: number;
  level: (typeof COURSE_DATA)[0];
  unlocked: boolean;
  isDone: boolean;
  isActive: boolean;
  isPlaying: boolean;
  showReview: boolean;
  onPlay: () => void;
  onMenu: () => void;
  onDownloadPdf: () => void;
  onNextLesson: () => void;
  onContinueToReview: () => void;
  onMarkComplete: () => void;
}) {
  const showNowPlayingIcon = isActive && isPlaying;

  return (
    <View style={[styles.playlistRowWrap, isActive && styles.playlistRowWrapActive]}>
      <View style={[styles.playlistRow, !unlocked && styles.playlistRowLocked]}>
        <TouchableOpacity
          style={styles.playlistRowMain}
          disabled={!unlocked}
          activeOpacity={0.7}
          onPress={onPlay}
        >
          <View style={styles.playlistDragHandle}>
            <View style={styles.playlistDragLine} />
            <View style={styles.playlistDragLine} />
          </View>

          <View style={styles.playlistThumbWrap}>
            <Image
              source={{ uri: `https://picsum.photos/seed/${lesson.id}/240/135` }}
              style={styles.playlistThumb}
            />
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
                <Text style={styles.durationText}>{lesson.duration}</Text>
              </View>
            )}
          </View>

          <View style={styles.playlistRowText}>
            <Text style={styles.playlistRowTitle} numberOfLines={2}>
              {lesson.title}
            </Text>
            <Text style={styles.playlistRowChannel} numberOfLines={1}>
              Aarambh English
            </Text>
            <Text style={styles.playlistRowMeta} numberOfLines={1}>
              {unlocked
                ? lessonStatsLine(lesson, lessonIndex, isDone)
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
            style={styles.pdfDownloadBtn}
            onPress={onDownloadPdf}
            activeOpacity={0.7}
          >
            <View style={styles.pdfIconWrap}>
              <Image
                source={{ uri: 'https://img.icons8.com/3d-fluency/48/pdf.png' }}
                style={styles.pdfIconImage}
                resizeMode="contain"
              />
              <View style={styles.pdfIconBadge}>
                <Text style={styles.pdfIconBadgeText}>PDF</Text>
              </View>
            </View>
            <View style={styles.pdfDownloadTextWrap}>
              <Text style={styles.pdfDownloadTitle}>Download PDF</Text>
              <Text style={styles.pdfDownloadSub} numberOfLines={1}>
                {lesson.pdfTitle}
              </Text>
            </View>
            <Feather name="download" size={20} color="#1A73E8" />
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

function CoursePlaylistView({
  level,
  levelUnlocked,
  completedLessons,
  focusIndex,
  playingLessonId,
  lessonReviewId,
  onPlay,
  onClosePlayer,
  onDownloadPdf,
  onNextLesson,
  onContinueToReview,
  onMarkComplete,
  renderPlayer,
  isFullscreen,
}: {
  level: (typeof COURSE_DATA)[0];
  levelUnlocked: boolean;
  completedLessons: string[];
  focusIndex: number;
  playingLessonId: string | null;
  lessonReviewId: string | null;
  onPlay: (lessonId: string) => void;
  onClosePlayer: () => void;
  onDownloadPdf: (lesson: Lesson) => void;
  onNextLesson: (lessonId: string) => void;
  onContinueToReview: (lessonId: string) => void;
  onMarkComplete: (lessonId: string) => void;
  renderPlayer: (isFull: boolean) => React.ReactNode;
  isFullscreen: boolean;
}) {
  const levelIcon = LEVEL_ICONS[level.id] ?? 'book-open-variant';
  const currentLesson = level.lessons[focusIndex] ?? level.lessons[0];
  const currentId = playingLessonId ?? currentLesson?.id;
  const currentIndex = level.lessons.findIndex((l) => l.id === currentId);
  const activeLesson = level.lessons[currentIndex >= 0 ? currentIndex : 0];
  const isPlaying = playingLessonId === activeLesson?.id && !isFullscreen;

  const openLessonMenu = (lesson: Lesson, index: number) => {
    const unlocked = levelUnlocked && isLessonUnlockedInRoadmap(level.lessons, index, completedLessons);
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

  const inPlayerMode = !!playingLessonId;

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
    item: { lesson: Lesson; index: number };
    index: number;
  }) => {
    const { lesson, index } = item;
    const unlocked =
      levelUnlocked && isLessonUnlockedInRoadmap(level.lessons, index, completedLessons);
    const isDone = completedLessons.includes(lesson.id);
    const isActive = !!playingLessonId && lesson.id === playingLessonId;
    const showReview = lessonReviewId === lesson.id;

    return (
      <View>
        {displayIndex === 1 && playingLessonId ? (
          <Text style={styles.playlistUpNextLabel}>Up next</Text>
        ) : null}
      <PlaylistLessonRow
        lesson={lesson}
        lessonIndex={index}
        level={level}
        unlocked={unlocked}
        isDone={isDone}
        isActive={isActive}
        isPlaying={isPlaying && isActive}
        showReview={showReview}
        onPlay={() => onPlay(lesson.id)}
        onMenu={() => openLessonMenu(lesson, index)}
        onDownloadPdf={() => onDownloadPdf(lesson)}
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
        !levelUnlocked && styles.lessonsLocked,
      ]}
    >
      {inPlayerMode && (
        <View style={[styles.playlistPlayerWrap, { height: PLAYLIST_PLAYER_HEIGHT }]}>
          {isPlaying ? (
            renderPlayer(false)
          ) : (
            <TouchableOpacity
              style={styles.playlistPlayerPlaceholder}
              activeOpacity={0.9}
              onPress={() => activeLesson && levelUnlocked && onPlay(activeLesson.id)}
              disabled={!levelUnlocked}
            >
              {activeLesson && (
                <>
                  <Image
                    source={{ uri: `https://picsum.photos/seed/${activeLesson.id}/800/450` }}
                    style={styles.playlistPlayerImage}
                  />
                  <View style={styles.playlistPlayerOverlay} />
                  <View style={styles.playlistPlayerPlay}>
                    <Ionicons name="play" size={36} color="#1F1F1F" />
                  </View>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{activeLesson.duration}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={[styles.playlistSheet, !inPlayerMode && styles.playlistSheetFull]}>
        <View style={styles.playlistSheetHeader}>
          <View style={[styles.playlistSheetIcon, { backgroundColor: `${level.color[0]}18` }]}>
            <MaterialCommunityIcons name={levelIcon} size={22} color={level.color[0]} />
          </View>
          <View style={styles.playlistSheetTitles}>
            <Text style={styles.playlistSheetTitle} numberOfLines={1}>
              {inPlayerMode ? `${level.title} — Now playing` : `${level.title} lessons`}
            </Text>
            <Text style={styles.playlistSheetSub} numberOfLines={2}>
              {inPlayerMode
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

        <FlatList
          style={styles.playlistScroll}
          data={playlistItems}
          keyExtractor={(item) => item.lesson.id}
          renderItem={renderPlaylistItem}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          ItemSeparatorComponent={() => <View style={styles.playlistRowDivider} />}
        />
      </View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyCoursesScreen() {
  const insets = useSafeAreaInsets();

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [lastLessonId, setLastLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<LevelId>('beginner');
  const [roadmapFocusIndex, setRoadmapFocusIndex] = useState(0);
  const [lessonReviewId, setLessonReviewId] = useState<string | null>(null);

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

  const videoRef = useRef<Video>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressWidthRef = useRef(0);
  const lastUiTickRef = useRef(0);
  const savedPositionRef = useRef(0);
  const needsSeekOnLoadRef = useRef(false);
  const playingLessonIdRef = useRef<string | null>(null);
  playingLessonIdRef.current = playingLessonId;

  // Load progress
  useEffect(() => {
    const init = async () => {
      try {
        // Fix Audio
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        const { completedLessons: saved, lastLessonId: last } = await loadCourseProgress();
        setCompletedLessons(saved);
        if (last) setLastLessonId(last);
      } catch (e) {
        console.error('Failed to load progress', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCourseProgress().then(({ completedLessons: saved, lastLessonId: last }) => {
        setCompletedLessons(saved);
        setLastLessonId(last);
      });
    }, [])
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

  const isLevelUnlockedForUser = (levelId: LevelId) =>
    isLevelUnlocked(levelId, completedLessons);

  const getLessonLevelId = (lessonId: string): LevelId | null => {
    for (const level of COURSE_DATA) {
      if (level.lessons.some((l) => l.id === lessonId)) return level.id;
    }
    return null;
  };

  const getVideoSourceForLesson = (lessonId: string | null) => {
    if (!lessonId) return LECTURE_VIDEO;
    const level = COURSE_DATA.find((l) => l.lessons.some((lesson) => lesson.id === lessonId));
    return level?.videoSource ?? LECTURE_VIDEO;
  };

  const pauseVideo = useCallback(() => {
    videoRef.current?.pauseAsync().catch(() => {});
  }, []);

  const playVideo = useCallback(() => {
    videoRef.current?.playAsync().catch(() => {});
  }, []);

  const closePlayer = useCallback(() => {
    pauseVideo();
    setPlayingLessonId(null);
    setIsFullscreen(false);
    setIsPaused(true);
    setIsVideoLoaded(false);
    setControlsVisible(true);
  }, [pauseVideo]);

  const syncRoadmapFocus = useCallback((levelId: LevelId, completed: string[]) => {
    const level = COURSE_DATA.find((l) => l.id === levelId);
    if (!level) return;
    const firstIncomplete = level.lessons.findIndex((l) => !completed.includes(l.id));
    setRoadmapFocusIndex(firstIncomplete >= 0 ? firstIncomplete : level.lessons.length - 1);
  }, []);

  useEffect(() => {
    if (!loading) syncRoadmapFocus(selectedCategory, completedLessons);
  }, [loading, selectedCategory, completedLessons, syncRoadmapFocus]);

  const handleSelectCategory = useCallback((id: LevelId) => {
    setSelectedCategory(id);
    setLessonReviewId(null);
    syncRoadmapFocus(id, completedLessons);
    pauseVideo();
    setPlayingLessonId(null);
    setIsFullscreen(false);
    setIsPaused(true);
    setIsVideoLoaded(false);
    setControlsVisible(true);
  }, [pauseVideo, completedLessons, syncRoadmapFocus]);

  const handleDownloadPdf = useCallback(async (lesson: Lesson) => {
    try {
      await WebBrowser.openBrowserAsync(SAMPLE_PDF_URL);
    } catch {
      alert(`Could not open PDF for ${lesson.pdfTitle}`);
    }
  }, []);

  const handleContinueToReview = useCallback((lessonId: string) => {
    pauseVideo();
    setIsPaused(true);
    setLessonReviewId(lessonId);
    setControlsVisible(true);
  }, [pauseVideo]);

  const activeLevel = COURSE_DATA.find((l) => l.id === selectedCategory)!;

  const handlePlay = (lessonId: string) => {
    saveCourseProgress(completedLessons, lessonId);
    setLastLessonId(lessonId);

    if (lessonId === playingLessonId) {
      closePlayer();
      return;
    }

    const levelId = getLessonLevelId(lessonId);
    if (levelId) setSelectedCategory(levelId);

    setLessonReviewId(null);
    const idx = activeLevel.lessons.findIndex((l) => l.id === lessonId);
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
    const level = COURSE_DATA.find((l) => l.lessons.some((lesson) => lesson.id === lessonId));
    if (!level) return;

    await markLessonComplete(lessonId);
    setLessonReviewId(null);

    const currentIndex = level.lessons.findIndex((l) => l.id === lessonId);
    if (currentIndex < level.lessons.length - 1) {
      const nextLesson = level.lessons[currentIndex + 1];
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
  }, [markLessonComplete, closePlayer]);

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
    if (!status.isLoaded) return;

    if (!isVideoLoaded) setIsVideoLoaded(true);

    if (needsSeekOnLoadRef.current) {
      needsSeekOnLoadRef.current = false;
      videoRef.current?.setPositionAsync(savedPositionRef.current).catch(() => {});
      if (!isPaused) playVideo();
    }

    setIsBuffering((prev) => (prev === status.isBuffering ? prev : status.isBuffering));

    const now = Date.now();
    if (now - lastUiTickRef.current >= 450) {
      lastUiTickRef.current = now;
      setCurrentTime(status.positionMillis / 1000);
      if (status.durationMillis) setDuration(status.durationMillis / 1000);
    }

    if (status.didJustFinish && playingLessonIdRef.current) {
      setIsPaused(true);
      setControlsVisible(true);
      pauseVideo();
      setLessonReviewId(playingLessonIdRef.current);
    }
  }, [isVideoLoaded, isPaused, pauseVideo, playVideo]);

  const openFullscreen = useCallback(() => {
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
    }).catch(() => setIsFullscreen(false));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, seconds));
    setCurrentTime(clamped);
    videoRef.current?.setPositionAsync(clamped * 1000).catch(() => {});
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleRotation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsLandscape(true);
    }
  };

  // Reset orientation on unmount or player close
  useEffect(() => {
    if (!isFullscreen && isLandscape) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscape(false);
    }
  }, [isFullscreen]);

  const renderPlayer = (isFull: boolean = false) => {
    const lesson = COURSE_DATA.flatMap(l => l.lessons).find(l => l.id === playingLessonId);
    if (!lesson) return null;

    const videoSource = getVideoSourceForLesson(playingLessonId);
    const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const showCenterControls = controlsVisible || !isVideoLoaded;
    const cinemaMode = isPaused && !controlsVisible && isVideoLoaded;

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
          useNativeControls={false}
          progressUpdateIntervalMillis={500}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />

        {!isVideoLoaded && (
          <View style={styles.playerLoading}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.playerLoadingText}>Loading video…</Text>
          </View>
        )}

        {isBuffering && isVideoLoaded && !isPaused && !cinemaMode && (
          <View style={styles.playerBuffering}>
            <ActivityIndicator size="small" color="#FFFFFF" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFE8E8" />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1A73E8" />
        </View>
      ) : (
        <View style={styles.mainColumn}>
          <View style={[styles.categoryBar, { paddingTop: insets.top + 4 }]}>
            <CategoryTabs
              selected={selectedCategory}
              onSelect={handleSelectCategory}
              isLevelUnlocked={isLevelUnlockedForUser}
            />
          </View>

          <CoursePlaylistView
            level={activeLevel}
            levelUnlocked={isLevelUnlockedForUser(activeLevel.id)}
            completedLessons={completedLessons}
            focusIndex={roadmapFocusIndex}
            playingLessonId={playingLessonId}
            lessonReviewId={lessonReviewId}
            onPlay={handlePlay}
            onClosePlayer={closePlayer}
            onDownloadPdf={handleDownloadPdf}
            onNextLesson={handleNextLesson}
            onContinueToReview={handleContinueToReview}
            onMarkComplete={toggleCompletion}
            renderPlayer={renderPlayer}
            isFullscreen={isFullscreen}
          />
        </View>
      )}

      <Modal
        visible={isFullscreen && !!playingLessonId}
        animationType="none"
        onRequestClose={closeFullscreen}
        statusBarTranslucent
      >
        <View style={[styles.fullscreenModalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          {playingLessonId ? renderPlayer(true) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollBody: { flex: 1 },
  mainColumn: { flex: 1 },
  categoryBar: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: '#F8F9FA',
  },
  playlistLayout: {
    flex: 1,
    backgroundColor: '#000',
  },
  playlistLayoutList: {
    backgroundColor: '#F8F9FA',
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
  playlistPlayerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -12,
    overflow: 'hidden',
  },
  playlistSheetFull: {
    marginTop: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  playlistSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
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
    backgroundColor: '#FFFFFF',
  },
  playlistRowWrapActive: {
    backgroundColor: '#F2F2E6',
  },
  playlistRowDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
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
  playlistRowLocked: { opacity: 0.5 },
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
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DADCE0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    minHeight: 24,
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryBtnActive: {
    borderWidth: 1,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  categoryBtnLocked: {
    opacity: 0.7,
  },
  categoryBtnLabel: {
    fontSize: 9,
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
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F6368',
    minWidth: 36,
    textAlign: 'right',
  },
  lessonsLocked: { opacity: 0.55 },
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
  playerBuffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
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