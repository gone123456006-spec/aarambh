import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameId,
  loadGameProgress,
  saveGameProgress,
  flushGameProgressSync,
  resolvePlayableProgress,
} from '@/utils/gameProgress';

export function useGameProgress(gameId: GameId, totalLevels: number) {
  const [idx, setIdxState] = useState(0);
  const [score, setScore] = useState(0);
  const [ready, setReady] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const canSave = useRef(false);

  useEffect(() => {
    let cancelled = false;
    canSave.current = false;
    setReady(false);

    (async () => {
      const saved = await loadGameProgress(gameId);
      if (cancelled) return;
      const resolved = resolvePlayableProgress(saved, totalLevels);
      setIdxState(resolved.idx);
      setScore(saved.score);
      setAllComplete(resolved.allComplete);
      canSave.current = true;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, totalLevels]);

  const setIdx = useCallback(
    (next: number | ((prev: number) => number)) => {
      setIdxState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        const clamped = Math.max(0, Math.min(value, Math.max(totalLevels, 0)));
        if (clamped < totalLevels) {
          setAllComplete(false);
        }
        return clamped;
      });
    },
    [totalLevels],
  );

  useEffect(() => {
    if (!canSave.current) return;
    void saveGameProgress(gameId, {
      level: idx,
      score,
      completed: allComplete || idx >= totalLevels,
    }).catch(() => {});
  }, [gameId, idx, score, allComplete, totalLevels]);

  useEffect(() => {
    return () => {
      void flushGameProgressSync(gameId).catch(() => {});
    };
  }, [gameId]);

  const finishCatalog = useCallback(async () => {
    setAllComplete(true);
    setIdxState(totalLevels);
    await saveGameProgress(gameId, {
      level: totalLevels,
      score,
      completed: true,
    });
  }, [gameId, totalLevels, score]);

  return { idx, setIdx, score, setScore, ready, allComplete, finishCatalog };
}
