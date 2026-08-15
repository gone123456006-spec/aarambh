import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { userScopedKey } from '@/utils/userStorage';

export type GameId = 'quiz' | 'scramble' | 'fill' | 'flash';

export interface GameProgress {
  /** Next unplayed 0-based level. If >= current catalog size, all available levels are done. */
  level: number;
  score: number;
  completed?: boolean;
}

const STORAGE_KEY = 'gameProgress';
const SERVER_SYNC_DEBOUNCE_MS = 800;

const DEFAULT: GameProgress = { level: 0, score: 0, completed: false };

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
  try {
    const key = await userScopedKey(STORAGE_KEY);
    await AsyncStorage.setItem(key, JSON.stringify(all));
  } catch {
    // No signed-in user — refuse unscoped writes.
  }
}

export async function loadGameProgress(gameId: GameId): Promise<GameProgress> {
  const all = await readAll();
  const saved = all[gameId];
  if (!saved) return { ...DEFAULT };
  return {
    level: Math.max(0, saved.level ?? 0),
    score: Math.max(0, saved.score ?? 0),
    completed: Boolean(saved.completed),
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

/** True when every currently shipped level has been finished. */
export function isGameCatalogComplete(progress: GameProgress | null | undefined, totalLevels: number): boolean {
  if (!progress || totalLevels <= 0) return false;
  return (progress.level ?? 0) >= totalLevels;
}

/**
 * Resume point after an app update.
 * Completed catalogs stay locked. If new levels are added, play continues from the first new level.
 */
export function resolvePlayableProgress(progress: GameProgress, totalLevels: number): {
  idx: number;
  allComplete: boolean;
} {
  if (totalLevels <= 0) return { idx: 0, allComplete: false };
  const level = Math.max(0, progress.level ?? 0);
  if (level >= totalLevels) {
    return { idx: totalLevels, allComplete: true };
  }
  return { idx: Math.min(level, totalLevels - 1), allComplete: false };
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
      completed: Boolean(progress.completed),
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
    completed: Boolean(progress.completed),
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
  // Allow `totalLevels` as a sentinel meaning "all current levels completed".
  return Math.min(Math.max(0, level), totalLevels);
}
