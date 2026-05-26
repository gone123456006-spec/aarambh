import AsyncStorage from '@react-native-async-storage/async-storage';
import { COURSE_DATA, LevelId, TOTAL_LESSONS } from '@/constants/courseData';
import { apiFetch } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { userScopedKey } from '@/utils/userStorage';

export const COMPLETED_LESSONS_KEY = 'completedLessons';
export const LAST_LESSON_KEY = 'lastLessonId';

export async function loadCourseProgress() {
  const completedKey = await userScopedKey(COMPLETED_LESSONS_KEY);
  const lastKey = await userScopedKey(LAST_LESSON_KEY);
  const saved = await AsyncStorage.getItem(completedKey);
  const last = await AsyncStorage.getItem(lastKey);
  return {
    completedLessons: saved ? (JSON.parse(saved) as string[]) : [],
    lastLessonId: last || null,
  };
}

export async function saveCourseProgress(completedLessons: string[], lastLessonId: string | null) {
  const completedKey = await userScopedKey(COMPLETED_LESSONS_KEY);
  const lastKey = await userScopedKey(LAST_LESSON_KEY);
  await AsyncStorage.multiSet([
    [completedKey, JSON.stringify(completedLessons)],
    [lastKey, lastLessonId ?? ''],
  ]);
}

export async function syncLessonToServer(lessonId: string, isCompleted = true) {
  const token = await getAccessToken();
  if (!token) return;
  await apiFetch('/api/courses/progress', {
    method: 'POST',
    body: JSON.stringify({ lessonId, isCompleted }),
  });
}

export function getOverallProgress(completedLessons: string[]) {
  return Math.round((completedLessons.length / TOTAL_LESSONS) * 100);
}

export function isLevelUnlocked(levelId: LevelId, completedLessons: string[]) {
  if (levelId === 'beginner') return true;
  if (levelId === 'intermediate') {
    const beginnerIds = COURSE_DATA[0].lessons.map((l) => l.id);
    return beginnerIds.every((id) => completedLessons.includes(id));
  }
  if (levelId === 'advanced') {
    const interIds = COURSE_DATA[1].lessons.map((l) => l.id);
    return interIds.every((id) => completedLessons.includes(id));
  }
  return false;
}

export function getLevelProgressRatio(levelId: LevelId, completedLessons: string[]) {
  const level = COURSE_DATA.find((l) => l.id === levelId);
  if (!level || level.lessons.length === 0) return 0;
  const completed = level.lessons.filter((l) => completedLessons.includes(l.id)).length;
  return completed / level.lessons.length;
}

export function getLevelCompletedCount(levelId: LevelId, completedLessons: string[]) {
  const level = COURSE_DATA.find((l) => l.id === levelId);
  if (!level) return 0;
  return level.lessons.filter((l) => completedLessons.includes(l.id)).length;
}

export function getLastLessonTitle(lastLessonId: string | null) {
  if (!lastLessonId) return null;
  return COURSE_DATA.flatMap((l) => l.lessons).find((l) => l.id === lastLessonId)?.title ?? null;
}
