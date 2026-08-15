import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type AppLesson = {
  id: string;
  mongoId?: string;
  title: string;
  duration: string;
  type: string;
  description: string;
  pdfTitle: string;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  videoAvailableIn?: number;
  pdfAvailableIn?: number;
  locked?: boolean;
};

export type AppCategory = {
  id: string;
  mongoId: string;
  title: string;
  subtitle: string;
  color: [string, string];
  lessons: AppLesson[];
  /** Requires a paid subscription for this category (from admin plans). */
  isPro: boolean;
  /** Locked because the user does not have access to this paid category. */
  locked: boolean;
};

export type ApiCourseLesson = {
  _id?: string;
  lessonKey?: string;
  title?: string;
  duration?: string;
  type?: string;
  description?: string;
  pdfTitle?: string;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  videoAvailableIn?: number;
  pdfAvailableIn?: number;
  locked?: boolean;
};

export type ApiCourse = {
  _id: string;
  level: string;
  title: string;
  subtitle?: string;
  color?: string[];
  lessons?: ApiCourseLesson[];
  isPro?: boolean;
  locked?: boolean;
};

const DEFAULT_COLORS: [string, string][] = [
  ['#00b894', '#55efc4'],
  ['#0984e3', '#74b9ff'],
  ['#6c5ce7', '#a29bfe'],
  ['#e60000', '#ff6b6b'],
  ['#e17055', '#fab1a0'],
];

export function mapApiCoursesToApp(courses: ApiCourse[]): AppCategory[] {
  return (courses || []).map((course, index) => {
    const colorPair =
      course.color?.length >= 2
        ? ([course.color[0], course.color[1]] as [string, string])
        : DEFAULT_COLORS[index % DEFAULT_COLORS.length];

    return {
      id: course.level,
      mongoId: course._id,
      title: course.title,
      subtitle: course.subtitle || '',
      color: colorPair,
      isPro: course.isPro ?? !/beginner/i.test(`${course.level || ''} ${course.title || ''}`),
      locked: Boolean(course.locked) && Boolean(course.isPro),
      lessons: (course.lessons || []).map((lesson) => ({
        id: lesson.lessonKey || lesson._id || '',
        mongoId: lesson._id,
        title: lesson.title || 'Untitled lesson',
        duration: lesson.duration || '0:00',
        type: lesson.type || 'video',
        description: lesson.description || '',
        pdfTitle: lesson.pdfTitle || `${lesson.title || 'Lesson'} notes`,
        videoUrl: lesson.videoUrl,
        pdfUrl: lesson.pdfUrl,
        videoAvailableIn: lesson.videoAvailableIn,
        pdfAvailableIn: lesson.pdfAvailableIn,
        locked: lesson.locked ?? false,
      })),
    };
  });
}

export function totalLessonCount(categories: AppCategory[]) {
  return categories.reduce((n, c) => n + c.lessons.length, 0);
}

export const LEVEL_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  beginner: 'seedling',
  intermediate: 'tree',
  advanced: 'medal',
};

export function iconForLevel(levelId: string): keyof typeof MaterialCommunityIcons.glyphMap {
  return LEVEL_ICONS[levelId] ?? 'book-open-variant';
}
