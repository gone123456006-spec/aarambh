import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/utils/api';
import type { GameId } from '@/constants/gameData';

export type QuizQuestion = {
  id: string;
  q: string;
  options: string[];
  answer: number;
  explanation?: string;
  level: number;
};

export type WordScramble = {
  id: string;
  word: string;
  hint: string;
  level: number;
};

export type FillBlank = {
  id: string;
  sentence: string;
  options: string[];
  answer: number;
  correctText: string;
  rule: string;
  level: number;
};

export type Flashcard = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  level: number;
};

export type GameQuestion = QuizQuestion | WordScramble | FillBlank | Flashcard;

export type GameLevelConfig = {
  gameId: GameId;
  maxLevel: number;
  description?: string;
  pointsPerCorrect: number;
};

/**
 * Fetch game questions dynamically from API for a specific game and level
 */
export function useGameQuestions(gameId: GameId | null, level: number) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!gameId || level < 1) {
      setQuestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<GameQuestion[]>(`/game-questions/${gameId}/levels/${level}`);
      setQuestions(data || []);
    } catch (err) {
      console.error(`Failed to fetch ${gameId} questions for level ${level}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load questions');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [gameId, level]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  return { questions, loading, error, refetch: fetchQuestions };
}

/**
 * Fetch game level configuration from API
 */
export function useGameLevelConfig(gameId: GameId | null) {
  const [config, setConfig] = useState<GameLevelConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!gameId) {
      setConfig(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<GameLevelConfig>(`/game-questions/${gameId}/levels`);
      setConfig(data);
    } catch (err) {
      console.error(`Failed to fetch ${gameId} level config:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load level config');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, refetch: fetchConfig };
}
