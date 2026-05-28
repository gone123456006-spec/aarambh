import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { userScopedKey } from '@/utils/userStorage';

export type GameId = 'quiz' | 'scramble' | 'fill' | 'flash';

export interface GameProgress {
  level: number;
  score: number;
}

const STORAGE_KEY = 'gameProgress';
const SERVER_SYNC_DEBOUNCE_MS = 800;

const DEFAULT: GameProgress = { level: 0, score: 0 };

const pendingServerSync = new Map<
  GameId,
  { timer: ReturnType<typeof setTimeout>; progress: GameProgress }
>();

async function readAll(): Promise<Partial<Record<GameId, GameProgress>>> {
  try {
    const key = await userScopedKey(STORAGE_KEY);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeAll(all: Partial<Record<GameId, GameProgress>>): Promise<void> {
  const key = await userScopedKey(STORAGE_KEY);
  await AsyncStorage.setItem(key, JSON.stringify(all));
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

async function syncProgressToServer(gameId: GameId, progress: GameProgress): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  await apiFetch('/api/games/progress', {
    method: 'POST',
    body: JSON.stringify({
      gameId,
      level: progress.level,
      score: progress.score,
    }),
  });
}

function scheduleServerSync(gameId: GameId, progress: GameProgress): void {
  const existing = pendingServerSync.get(gameId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingServerSync.delete(gameId);
    void syncProgressToServer(gameId, progress).catch(() => {});
  }, SERVER_SYNC_DEBOUNCE_MS);

  pendingServerSync.set(gameId, { timer, progress });
}

/** Push the latest debounced progress immediately (e.g. leaving a game). */
export async function flushGameProgressSync(gameId: GameId): Promise<void> {
  const pending = pendingServerSync.get(gameId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingServerSync.delete(gameId);
    try {
      await syncProgressToServer(gameId, pending.progress);
    } catch {
      // Best-effort; local copy is authoritative offline.
    }
    return;
  }

  try {
    const progress = await loadGameProgress(gameId);
    await syncProgressToServer(gameId, progress);
  } catch {
    // Ignore sync errors.
  }
}

export async function saveGameProgress(gameId: GameId, progress: GameProgress): Promise<void> {
  const normalized: GameProgress = {
    level: Math.max(0, progress.level),
    score: Math.max(0, progress.score),
  };

  try {
    const all = await readAll();
    all[gameId] = normalized;
    await writeAll(all);
  } catch (e) {
    if (__DEV__) console.warn('Failed to save game progress locally', e);
    return;
  }

  scheduleServerSync(gameId, normalized);
}

export async function clearGameProgress(gameId: GameId): Promise<void> {
  const pending = pendingServerSync.get(gameId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingServerSync.delete(gameId);
  }

  try {
    const all = await readAll();
    delete all[gameId];
    await writeAll(all);
  } catch (e) {
    if (__DEV__) console.warn('Failed to clear game progress', e);
  }
}

export function clampLevel(level: number, totalLevels: number): number {
  if (totalLevels <= 0) return 0;
  return Math.min(Math.max(0, level), totalLevels - 1);
}
