import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { userScopedKey } from '@/utils/userStorage';
import { AppCategory, totalLessonCount } from '@/utils/liveCourses';
import {
  getLastLessonTitle,
  getLevelCompletedCount,
  getLevelProgressRatio,
  isLevelUnlocked,
} from '@/utils/courseLevelProgress';

export const COMPLETED_LESSONS_KEY = 'completedLessons';
export const LAST_LESSON_KEY = 'lastLessonId';

export async function loadCourseProgress() {
  try {
    const completedKey = await userScopedKey(COMPLETED_LESSONS_KEY);
    const lastKey = await userScopedKey(LAST_LESSON_KEY);
    const saved = await AsyncStorage.getItem(completedKey);
    const last = await AsyncStorage.getItem(lastKey);
    return {
      completedLessons: saved ? (JSON.parse(saved) as string[]) : [],
      lastLessonId: last || null,
    };
  } catch {
    return { completedLessons: [], lastLessonId: null };
  }
}

export async function saveCourseProgress(completedLessons: string[], lastLessonId: string | null) {
  try {
    const completedKey = await userScopedKey(COMPLETED_LESSONS_KEY);
    const lastKey = await userScopedKey(LAST_LESSON_KEY);
    await AsyncStorage.multiSet([
      [completedKey, JSON.stringify(completedLessons)],
      [lastKey, lastLessonId ?? ''],
    ]);
  } catch {
    // No signed-in user — refuse to write shared/unscoped progress.
  }
}

export async function syncLessonToServer(lessonId: string, isCompleted = true) {
  const token = await getAccessToken();
  if (!token) return;
  await apiFetch('/api/courses/progress', {
    method: 'POST',
    body: JSON.stringify({ lessonId, isCompleted }),
  });
}

export function getOverallProgress(completedLessons: string[], categories: AppCategory[]) {
  const total = totalLessonCount(categories);
  if (total === 0) return 0;
  return Math.round((completedLessons.length / total) * 100);
}

export {
  isLevelUnlocked,
  getLevelProgressRatio,
  getLevelCompletedCount,
  getLastLessonTitle,
};
