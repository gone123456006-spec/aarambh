/** Lesson order keys — must match frontend constants/courseData.ts */
const LESSON_ORDER = {
  b1: 0,
  b2: 1,
  b3: 2,
  b4: 3,
  b5: 4,
  i1: 5,
  i2: 6,
  i3: 7,
  i4: 8,
  i5: 9,
  a1: 10,
  a2: 11,
  a3: 12,
  a4: 13,
  a5: 14,
  a6: 15,
  a7: 16,
  a8: 17,
  a9: 18,
  a10: 19,
};

function lessonSortIndex(lesson) {
  if (lesson.lessonKey && LESSON_ORDER[lesson.lessonKey] !== undefined) {
    return LESSON_ORDER[lesson.lessonKey];
  }
  return lesson.order ?? 999;
}

function sortCourseLessons(lessons) {
  return [...lessons].sort((a, b) => lessonSortIndex(a) - lessonSortIndex(b));
}

module.exports = { LESSON_ORDER, lessonSortIndex, sortCourseLessons };
