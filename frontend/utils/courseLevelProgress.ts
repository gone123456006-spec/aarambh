import { AppCategory } from '@/utils/liveCourses';

export function isLevelUnlocked(
  levelId: string,
  completedLessons: string[],
  categories: AppCategory[],
) {
  const index = categories.findIndex((c) => c.id === levelId);
  if (index <= 0) return true;
  const previous = categories[index - 1];
  if (!previous?.lessons?.length) return true;
  return previous.lessons.every((l) => completedLessons.includes(l.id));
}

export function getLevelProgressRatio(
  levelId: string,
  completedLessons: string[],
  categories: AppCategory[],
) {
  const level = categories.find((l) => l.id === levelId);
  if (!level || level.lessons.length === 0) return 0;
  const completed = level.lessons.filter((l) => completedLessons.includes(l.id)).length;
  return completed / level.lessons.length;
}

export function getLevelCompletedCount(
  levelId: string,
  completedLessons: string[],
  categories: AppCategory[],
) {
  const level = categories.find((l) => l.id === levelId);
  if (!level) return 0;
  return level.lessons.filter((l) => completedLessons.includes(l.id)).length;
}

export function getLastLessonTitle(lastLessonId: string | null, categories: AppCategory[]) {
  if (!lastLessonId) return null;
  return categories.flatMap((l) => l.lessons).find((l) => l.id === lastLessonId)?.title ?? null;
}
