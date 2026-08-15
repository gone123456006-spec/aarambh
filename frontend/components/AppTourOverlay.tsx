import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUI } from '@/constants/theme';
import { Icons3D } from '@/constants/homeIcons';
import { userScopedKey } from '@/utils/userStorage';

const TOUR_STATE_BASE_KEY = 'appTourState';

type TourStep = {
  key: string;
  image: number;
  title: string;
  description: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    key: 'welcome',
    image: Icons3D.graduationCap,
    title: 'Welcome to Ohm\u2019s English',
    description:
      'Learn and practice English in one place — courses, live chat, games, and more.',
  },
  {
    key: 'courses',
    image: Icons3D.pencil,
    title: 'Video courses',
    description:
      'Beginner lessons are free. Open My Courses to watch videos and track your progress.',
  },
  {
    key: 'notes',
    image: Icons3D.pdf,
    title: 'PDF notes',
    description:
      'Download lesson notes as PDFs so you can revise offline anytime.',
  },
  {
    key: 'chat',
    image: Icons3D.speechBubble,
    title: 'Chat in English',
    description:
      'Match with real learners and practice written English in a live chat.',
  },
  {
    key: 'call',
    image: Icons3D.phone,
    title: 'Call in English',
    description:
      'Start a voice or video call with a random learner and practice speaking.',
  },
  {
    key: 'group',
    image: Icons3D.conferenceCall,
    title: 'Group discussion',
    description:
      'Join small group sessions to practice speaking with more learners together.',
  },
  {
    key: 'games',
    image: Icons3D.puzzle,
    title: 'English games',
    description:
      'Play quizzes, word puzzles and flashcards to build vocabulary and earn points.',
  },
  {
    key: 'rewards',
    image: Icons3D.seedling,
    title: 'Daily rewards',
    description:
      'Learn a new word every day and claim reward points from the Rewards tab.',
  },
  {
    key: 'leaderboard',
    image: Icons3D.trophy,
    title: 'Leaderboard',
    description:
      'Climb the ranks by earning points from courses, games and daily rewards.',
  },
  {
    key: 'performance',
    image: Icons3D.comboChart,
    title: 'Your performance',
    description:
      'Track course completion, game scores and accuracy in the Performance screen.',
  },
  {
    key: 'achievements',
    image: Icons3D.medal,
    title: 'Achievements',
    description:
      'Earn medals and milestones as you complete lessons, games and daily challenges.',
  },
  {
    key: 'notifications',
    image: Icons3D.help,
    title: 'Notifications',
    description:
      'Tap the bell on Home for welcome tips, course updates, rewards and chat alerts.',
  },
  {
    key: 'pro',
    image: Icons3D.crown,
    title: 'Course subscriptions',
    description:
      'Paid categories can be unlocked from Profile or My Courses. A coupon is optional at checkout.',
  },
];

/** Marks the tour as done so it never auto-shows again for this user on this device. */
async function markTourSeen(): Promise<void> {
  try {
    const key = await userScopedKey(TOUR_STATE_BASE_KEY);
    await AsyncStorage.setItem(key, 'done');
  } catch {
    /* not signed in */
  }
}

/**
 * Queue the tour for a brand-new account. Call right after signup
 * (when the auth API reports isNewUser) — existing users never see it.
 */
export async function queueAppTourForNewUser(): Promise<void> {
  try {
    const key = await userScopedKey(TOUR_STATE_BASE_KEY);
    const state = await AsyncStorage.getItem(key);
    if (state !== 'done') {
      await AsyncStorage.setItem(key, 'pending');
    }
  } catch {
    /* not signed in */
  }
}

/** True only when a first-time signup queued the tour and it hasn't been finished yet. */
export async function shouldShowAppTour(): Promise<boolean> {
  try {
    const key = await userScopedKey(TOUR_STATE_BASE_KEY);
    const state = await AsyncStorage.getItem(key);
    return state === 'pending';
  } catch {
    return false;
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AppTourOverlay({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  const finish = useCallback(() => {
    void markTourSeen();
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, finish]);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const progress = (stepIndex + 1) / TOUR_STEPS.length;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={finish}
    >
      <StatusBar barStyle="dark-content" backgroundColor={AppUI.bg} />
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>App overview</Text>
          {!isLast ? (
            <TouchableOpacity
              onPress={finish}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Skip app tour"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepLabel}>
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </Text>

        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Image source={step.image} style={styles.iconImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </View>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={handleNext}
          activeOpacity={0.88}
          accessibilityLabel={isLast ? 'Finish app tour' : 'Next tour step'}
        >
          <Text style={styles.nextBtnText}>{isLast ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppUI.bg,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppUI.text,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppUI.textSecondary,
  },
  skipPlaceholder: {
    width: 36,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: AppUI.surfaceMuted,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: AppUI.accent,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppUI.textTertiary,
    marginBottom: 8,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 28,
    backgroundColor: AppUI.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconImage: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: AppUI.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: AppUI.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  nextBtn: {
    backgroundColor: AppUI.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
