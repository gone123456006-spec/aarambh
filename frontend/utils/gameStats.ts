import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { userScopedKey } from '@/utils/userStorage';
import { POINTS_PER_CORRECT_LEVEL } from '@/constants/gameData';
import { GameId } from '@/utils/gameProgress';

export interface GameStats {
  correct: number;
  incorrect: number;
  points: number;
}

const STORAGE_KEY = 'gameStats';

const EMPTY: GameStats = { correct: 0, incorrect: 0, points: 0 };

async function readAll(): Promise<Partial<Record<GameId, GameStats>>> {
  try {
    const key = await userScopedKey(STORAGE_KEY);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function loadGameStats(gameId: GameId): Promise<GameStats> {
  const all = await readAll();
  return all[gameId] ?? { ...EMPTY };
}

export async function loadAllGameStats(): Promise<Record<GameId, GameStats>> {
  const all = await readAll();
  return {
    quiz: all.quiz ?? { ...EMPTY },
    scramble: all.scramble ?? { ...EMPTY },
    fill: all.fill ?? { ...EMPTY },
    flash: all.flash ?? { ...EMPTY },
  };
}

export async function recordGameAnswer(gameId: GameId, correct: boolean): Promise<void> {
  try {
    const all = await readAll();
    const stats = all[gameId] ?? { ...EMPTY };
    if (correct) {
      stats.correct += 1;
      stats.points += POINTS_PER_CORRECT_LEVEL;
    } else {
      stats.incorrect += 1;
    }
    all[gameId] = stats;
    const key = await userScopedKey(STORAGE_KEY);
    await AsyncStorage.setItem(key, JSON.stringify(all));

    const token = await getAccessToken();
    if (token) {
      await apiFetch('/api/games/score', {
        method: 'POST',
        body: JSON.stringify({ gameId, isCorrect: correct }),
      });
    }
  } catch {
    // Stats remain on device if the server is unreachable / user not signed in.
  }
}

export async function getTotalGameScore(): Promise<number> {
  try {
    const key = await userScopedKey('totalGameScore');
    const raw = await AsyncStorage.getItem(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function setTotalGameScore(score: number): Promise<void> {
  try {
    const key = await userScopedKey('totalGameScore');
    await AsyncStorage.setItem(key, String(score));
    schedulePointsSync(score);
  } catch {
    // No signed-in user — refuse unscoped writes.
  }
}

let pointsSyncTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePointsSync(score: number) {
  if (pointsSyncTimer) clearTimeout(pointsSyncTimer);
  pointsSyncTimer = setTimeout(() => {
    void syncPointsToServer(score);
  }, 600);
}

async function syncPointsToServer(score: number) {
  const token = await getAccessToken();
  if (!token) return;
  try {
    await apiFetch('/api/users/me/points', {
      method: 'POST',
      body: JSON.stringify({ points: score }),
    });
  } catch {
    // Local score remains; server sync retries on next update or leaderboard open.
  }
}

export function getTotals(stats: Record<GameId, GameStats>) {
  return Object.values(stats).reduce(
    (acc, s) => ({
      correct: acc.correct + s.correct,
      incorrect: acc.incorrect + s.incorrect,
      points: acc.points + s.points,
    }),
    { correct: 0, incorrect: 0, points: 0 },
  );
}
