import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to record game stats', e);
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
