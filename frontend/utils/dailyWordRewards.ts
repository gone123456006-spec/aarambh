import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTotalGameScore, setTotalGameScore } from '@/utils/gameStats';
import { userScopedKey } from '@/utils/userStorage';
import { DAILY_WORD_TOTAL_DAYS } from '@/constants/dailyWords';

export const DAILY_WORD_POINTS = 5;
export const JOURNEY_COMPLETION_BONUS = 2999;

const CLAIMED_DAY_KEY = 'dailyWordClaimedEpochDay';
const COMPLETED_DAYS_KEY = 'dailyWordCompletedEpochDays';
const JOURNEY_BONUS_CLAIMED_KEY = 'dailyWordJourneyBonusClaimed';

type RewardStatusListener = () => void;
const rewardStatusListeners = new Set<RewardStatusListener>();

export function subscribeDailyRewardStatus(listener: RewardStatusListener): () => void {
  rewardStatusListeners.add(listener);
  return () => rewardStatusListeners.delete(listener);
}

function notifyDailyRewardStatusChanged(): void {
  rewardStatusListeners.forEach((fn) => fn());
}

function todayEpochDay(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24));
}

async function readCompletedEpochDays(): Promise<number[]> {
  try {
    const key = await userScopedKey(COMPLETED_DAYS_KEY);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
  } catch {
    return [];
  }
}

async function writeCompletedEpochDays(days: number[]): Promise<void> {
  const key = await userScopedKey(COMPLETED_DAYS_KEY);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  await AsyncStorage.setItem(key, JSON.stringify(unique));
}

/** Days the user has claimed the daily word reward (max 100). */
export async function getDailyWordCompletedCount(): Promise<number> {
  let days = await readCompletedEpochDays();
  if (days.length === 0) {
    try {
      const claimKey = await userScopedKey(CLAIMED_DAY_KEY);
      const last = await AsyncStorage.getItem(claimKey);
      if (last) {
        const epoch = parseInt(last, 10);
        if (!Number.isNaN(epoch)) {
          days = [epoch];
          await writeCompletedEpochDays(days);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return Math.min(DAILY_WORD_TOTAL_DAYS, days.length);
}

async function markTodayCompleted(): Promise<void> {
  const today = todayEpochDay();
  const days = await readCompletedEpochDays();
  if (!days.includes(today)) {
    await writeCompletedEpochDays([...days, today]);
  }
}

export async function hasReceivedJourneyBonus(): Promise<boolean> {
  try {
    const key = await userScopedKey(JOURNEY_BONUS_CLAIMED_KEY);
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function tryAwardJourneyBonus(currentScore: number): Promise<{
  bonusAdded: number;
  totalScore: number;
}> {
  if (await hasReceivedJourneyBonus()) {
    return { bonusAdded: 0, totalScore: currentScore };
  }

  const completed = await getDailyWordCompletedCount();
  if (completed < DAILY_WORD_TOTAL_DAYS) {
    return { bonusAdded: 0, totalScore: currentScore };
  }

  const totalScore = currentScore + JOURNEY_COMPLETION_BONUS;
  await setTotalGameScore(totalScore);
  const key = await userScopedKey(JOURNEY_BONUS_CLAIMED_KEY);
  await AsyncStorage.setItem(key, '1');
  return { bonusAdded: JOURNEY_COMPLETION_BONUS, totalScore };
}

export async function hasClaimedDailyWordToday(): Promise<boolean> {
  try {
    const key = await userScopedKey(CLAIMED_DAY_KEY);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    return parseInt(raw, 10) === todayEpochDay();
  } catch {
    return false;
  }
}

/** Award +5 points once per day; +2999 bonus once when 100 days are completed. */
export async function claimDailyWordPoints(): Promise<{
  claimed: boolean;
  pointsAdded: number;
  journeyBonusAdded: number;
  totalScore: number;
}> {
  const already = await hasClaimedDailyWordToday();
  const totalScore = await getTotalGameScore();
  if (already) {
    return { claimed: false, pointsAdded: 0, journeyBonusAdded: 0, totalScore };
  }

  const next = totalScore + DAILY_WORD_POINTS;
  await setTotalGameScore(next);
  const key = await userScopedKey(CLAIMED_DAY_KEY);
  await AsyncStorage.setItem(key, String(todayEpochDay()));
  await markTodayCompleted();

  const { bonusAdded, totalScore: afterBonus } = await tryAwardJourneyBonus(next);

  notifyDailyRewardStatusChanged();

  return {
    claimed: true,
    pointsAdded: DAILY_WORD_POINTS,
    journeyBonusAdded: bonusAdded,
    totalScore: afterBonus,
  };
}

export function isAdvancedDailyWord(dayNumber: number): boolean {
  return dayNumber >= 76;
}
