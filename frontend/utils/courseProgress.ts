import AsyncStorage from '@react-native-async-storage/async-storage';
import { COURSE_DATA, LevelId, TOTAL_LESSONS } from '@/constants/courseData';

export const COMPLETED_LESSONS_KEY = 'completedLessons';
export const LAST_LESSON_KEY = 'lastLessonId';

export async function loadCourseProgress() {
  const saved = await AsyncStorage.getItem(COMPLETED_LESSONS_KEY);
  const last = await AsyncStorage.getItem(LAST_LESSON_KEY);
  return {
    completedLessons: saved ? (JSON.parse(saved) as string[]) : [],
    lastLessonId: last,
  };
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
