/** Sort lessons by order, then lessonKey. */
function sortCourseLessons(lessons) {
  return [...(lessons || [])].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return String(a.lessonKey || a.title || '').localeCompare(String(b.lessonKey || b.title || ''));
  });
}

function slugifyLevel(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

const DEFAULT_CATEGORY_COLORS = {
  beginner: ['#00b894', '#55efc4'],
  intermediate: ['#0984e3', '#74b9ff'],
  advanced: ['#6c5ce7', '#a29bfe'],
};

const FALLBACK_COLORS = [
  ['#e60000', '#ff6b6b'],
  ['#e17055', '#fab1a0'],
  ['#00cec9', '#81ecec'],
  ['#fd79a8', '#fdcb6e'],
];

function colorsForLevel(level, index = 0) {
  if (DEFAULT_CATEGORY_COLORS[level]) return DEFAULT_CATEGORY_COLORS[level];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/** Levels that are free unless a paid plan is enabled for them. */
const FREE_LEVELS = ['beginner'];

function isBeginnerLike(level, title) {
  const slug = slugifyLevel(level);
  const combined = `${slug} ${slugifyLevel(title)}`.replace(/-/g, ' ');
  return slug === 'beginner' || slug.includes('beginner') || combined.includes('beginner');
}

function isIntermediateLike(level, title) {
  const slug = slugifyLevel(level);
  const combined = `${slug} ${slugifyLevel(title)}`.replace(/-/g, ' ');
  return slug === 'intermediate' || slug.includes('intermediate') || combined.includes('intermediate');
}

function isAdvancedLike(level, title) {
  const slug = slugifyLevel(level);
  const combined = `${slug} ${slugifyLevel(title)}`.replace(/-/g, ' ');
  return slug === 'advanced' || slug.includes('advanced') || combined.includes('advanced');
}

/** Map course level + title to subscription slug (beginner | intermediate | advanced). */
function resolveCategorySlug(level, title) {
  if (isBeginnerLike(level, title)) return 'beginner';
  if (isIntermediateLike(level, title)) return 'intermediate';
  if (isAdvancedLike(level, title)) return 'advanced';
  return slugifyLevel(level);
}

/**
 * Paid only when the course maps to Intermediate or Advanced.
 * Custom categories (e.g. english-grammer) stay free so admin uploads
 * play for every user unless you add a matching paid plan later.
 */
function isProLevel(level, title) {
  return isIntermediateLike(level, title) || isAdvancedLike(level, title);
}

module.exports = {
  sortCourseLessons,
  slugifyLevel,
  colorsForLevel,
  DEFAULT_CATEGORY_COLORS,
  FREE_LEVELS,
  isBeginnerLike,
  isIntermediateLike,
  isAdvancedLike,
  resolveCategorySlug,
  isProLevel,
};
