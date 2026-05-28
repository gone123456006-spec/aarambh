import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/utils/api';
import { AUTH_KEYS } from '@/utils/authStorage';
import { userScopedKey } from '@/utils/userStorage';
import {
  COMPLETED_LESSONS_KEY,
  LAST_LESSON_KEY,
} from '@/utils/courseProgress';
import type { GameId } from '@/utils/gameProgress';

type ApiUser = {
  _id?: string;
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  gender?: string;
  region?: string;
  level?: string;
};

type CourseProgressDoc = {
  completedLessons?: string[];
  lastLessonId?: string | null;
};

type GameProgressEntry = {
  level?: number;
  score?: number;
  stats?: {
    correctAnswers?: number;
    totalAttempts?: number;
  };
};

const GAME_IDS: GameId[] = ['quiz', 'scramble', 'fill', 'flash'];

/**
 * Pull the logged-in user's profile & progress from the API into scoped local storage.
 */
export async function syncUserDataFromServer(): Promise<void> {
  const userId = await AsyncStorage.getItem(AUTH_KEYS.userId);
  if (!userId) return;

  const [profileRes, courseRes, gamesRes, scoreRes] = await Promise.all([
    apiFetch<{ data: ApiUser }>('/api/users/me'),
    apiFetch<{ data: CourseProgressDoc }>('/api/courses/progress'),
    apiFetch<{ data: Record<GameId, GameProgressEntry> }>('/api/games/progress'),
    apiFetch<{ data: { totalScore: number } }>('/api/games/total-score'),
  ]);

  const user = profileRes.data;
  const course = courseRes.data ?? {};
  const games = gamesRes.data ?? {};
  const totalScore = scoreRes.data?.totalScore ?? 0;

  const profileEntries: [string, string][] = [
    [AUTH_KEYS.userEmail, user.email ?? ''],
    [AUTH_KEYS.userName, user.name ?? ''],
    [AUTH_KEYS.userPhone, user.phone ?? ''],
    [AUTH_KEYS.gender, user.gender ?? ''],
    [AUTH_KEYS.userRegion, user.region ?? ''],
    [AUTH_KEYS.level, user.level ?? ''],
  ];

  const completedKey = await userScopedKey(COMPLETED_LESSONS_KEY);
  const lastLessonKey = await userScopedKey(LAST_LESSON_KEY);
  const gameProgressKey = await userScopedKey('gameProgress');
  const gameStatsKey = await userScopedKey('gameStats');
  const totalScoreKey = await userScopedKey('totalGameScore');

  // If the backend hasn't persisted daily reward points yet, your local score may be higher.
  // Prevent points from dropping after logout/login by keeping the max of (server, local).
  const localTotalRaw = await AsyncStorage.getItem(totalScoreKey);
  const localTotalScore = localTotalRaw ? parseInt(localTotalRaw, 10) || 0 : 0;
  const finalTotalScore = Math.max(totalScore, localTotalScore);

  const gameProgress: Partial<Record<GameId, { level: number; score: number }>> = {};
  const gameStats: Partial<
    Record<GameId, { correct: number; incorrect: number; points: number }>
  > = {};

  for (const id of GAME_IDS) {
    const g = games[id];
    gameProgress[id] = {
      level: g?.level ?? 0,
      score: g?.score ?? 0,
    };
    const correct = g?.stats?.correctAnswers ?? 0;
    const attempts = g?.stats?.totalAttempts ?? 0;
    gameStats[id] = {
      correct,
      incorrect: Math.max(0, attempts - correct),
      points: g?.score ?? 0,
    };
  }

  await AsyncStorage.multiSet([
    ...profileEntries,
    [completedKey, JSON.stringify(course.completedLessons ?? [])],
    [lastLessonKey, course.lastLessonId ?? ''],
    [gameProgressKey, JSON.stringify(gameProgress)],
    [gameStatsKey, JSON.stringify(gameStats)],
    [totalScoreKey, String(finalTotalScore)],
  ]);
}
