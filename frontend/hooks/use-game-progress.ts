import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameId,
  loadGameProgress,
  saveGameProgress,
  clearGameProgress,
  flushGameProgressSync,
  clampLevel,
} from '@/utils/gameProgress';

export function useGameProgress(gameId: GameId, totalLevels: number) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [ready, setReady] = useState(false);
  const canSave = useRef(false);

  useEffect(() => {
    let cancelled = false;
    canSave.current = false;
    setReady(false);

    (async () => {
      const saved = await loadGameProgress(gameId);
      if (cancelled) return;
      setIdx(clampLevel(saved.level, totalLevels));
      setScore(saved.score);
      canSave.current = true;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, totalLevels]);

  useEffect(() => {
    if (!canSave.current) return;
    void saveGameProgress(gameId, { level: idx, score }).catch(() => {});
  }, [gameId, idx, score]);

  useEffect(() => {
    return () => {
      void flushGameProgressSync(gameId).catch(() => {});
    };
  }, [gameId]);

  const completeGame = useCallback(async () => {
    await clearGameProgress(gameId);
    setIdx(0);
    setScore(0);
  }, [gameId]);

  return { idx, setIdx, score, setScore, ready, completeGame };
}
