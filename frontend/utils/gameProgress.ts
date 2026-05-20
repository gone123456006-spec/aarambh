import AsyncStorage from '@react-native-async-storage/async-storage';

export type GameId = 'quiz' | 'scramble' | 'fill' | 'flash';

export interface GameProgress {
  level: number;
  score: number;
}

const STORAGE_KEY = 'gameProgress';

const DEFAULT: GameProgress = { level: 0, score: 0 };

async function readAll(): Promise<Partial<Record<GameId, GameProgress>>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function loadGameProgress(gameId: GameId): Promise<GameProgress> {
  const all = await readAll();
  const saved = all[gameId];
  if (!saved) return { ...DEFAULT };
  return {
    level: Math.max(0, saved.level ?? 0),
    score: Math.max(0, saved.score ?? 0),
  };
}

export async function loadAllGameProgress(): Promise<Record<GameId, GameProgress>> {
  const all = await readAll();
  return {
    quiz: all.quiz ?? { ...DEFAULT },
    scramble: all.scramble ?? { ...DEFAULT },
    fill: all.fill ?? { ...DEFAULT },
    flash: all.flash ?? { ...DEFAULT },
  };
}

export async function saveGameProgress(gameId: GameId, progress: GameProgress): Promise<void> {
  try {
    const all = await readAll();
    all[gameId] = {
      level: Math.max(0, progress.level),
      score: Math.max(0, progress.score),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save game progress', e);
  }
}

export async function clearGameProgress(gameId: GameId): Promise<void> {
  try {
    const all = await readAll();
    delete all[gameId];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to clear game progress', e);
  }
}

export function clampLevel(level: number, totalLevels: number): number {
  if (totalLevels <= 0) return 0;
  return Math.min(Math.max(0, level), totalLevels - 1);
}
