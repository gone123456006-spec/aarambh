const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { applyCourseMediaAvailability } = require('../utils/mediaAvailability');
const { sortCourseLessons, isProLevel } = require('../constants/curriculum');
const { ownedBy } = require('../utils/ownership');
const { hasActiveSubscription } = require('../services/subscriptionService');

/**
 * Flag Pro courses and strip their lesson media for users without an active
 * subscription. Beginner courses stay fully open. This is the authoritative
 * backend gate — the frontend cannot bypass it.
 */
function applyProAccess(courseDoc, subscribed) {
  const pro = isProLevel(courseDoc.level);
  const locked = pro && !subscribed;
  const out = { ...courseDoc, isPro: pro, locked };

  if (locked && Array.isArray(out.lessons)) {
    out.lessons = out.lessons.map((lesson) => ({
      ...lesson,
      videoUrl: null,
      pdfUrl: null,
      locked: true,
    }));
  }

  return out;
}

/**
 * Get all courses, grouped or sorted by level
 * (Shared catalog — not user-owned content.)
 */
const getCourses = asyncHandler(async (req, res) => {
  const subscribed = await hasActiveSubscription(req.user._id);
  const courses = await Course.find({}).sort({ sortOrder: 1, createdAt: 1 });
  const withMedia = courses.map((course) => {
    const doc = course.toObject();
    doc.lessons = sortCourseLessons(doc.lessons || []);
    return applyProAccess(applyCourseMediaAvailability(doc), subscribed);
  });
  res.status(200).json(new ApiResponse(200, withMedia, 'Courses retrieved successfully'));
});

/**
 * Get single course by ID or level
 */
const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let course;
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    course = await Course.findById(id);
  } else {
    course = await Course.findOne({ level: id });
  }

  if (!course) {
    throw new ApiError(404, `Course with identifier ${id} not found`);
  }

  course.views += 1;
  await course.save();

  const subscribed = await hasActiveSubscription(req.user._id);
  const doc = applyProAccess(applyCourseMediaAvailability(course), subscribed);

  res.status(200).json(new ApiResponse(200, doc, 'Course retrieved successfully'));
});

/**
 * Get the current user's course progress only
 */
const getProgress = asyncHandler(async (req, res) => {
  let progress = await CourseProgress.findOne(ownedBy(req.user._id));

  if (!progress) {
    progress = {
      completedLessons: [],
      lastLessonId: null,
    };
  }

  res.status(200).json(new ApiResponse(200, progress, 'Course progress retrieved successfully'));
});

/**
 * Update lesson completion — authenticated user only
 */
const updateProgress = asyncHandler(async (req, res) => {
  const { lessonId, isCompleted } = req.body;

  if (!lessonId) {
    throw new ApiError(400, 'Lesson ID is required');
  }

  let progress = await CourseProgress.findOne(ownedBy(req.user._id));

  if (!progress) {
    progress = new CourseProgress({
      user: req.user._id,
      completedLessons: [],
      lastLessonId: null,
    });
  }

  const alreadyCompleted = progress.completedLessons.includes(lessonId);

  if (isCompleted === true || isCompleted === undefined) {
    if (!alreadyCompleted) {
      progress.completedLessons.push(lessonId);
    }
    progress.lastLessonId = lessonId;
  } else if (isCompleted === false) {
    progress.completedLessons = progress.completedLessons.filter((id) => id !== lessonId);
  }

  await progress.save();

  if ((isCompleted === true || isCompleted === undefined) && !alreadyCompleted) {
    try {
      const notificationService = require('../services/notificationService');
      await notificationService.notifyLessonCompleted(req.user._id, lessonId);
    } catch (err) {
      console.error('Course notification failed:', err.message || err);
    }
  }

  res.status(200).json(new ApiResponse(200, progress, 'Course progress updated successfully'));
});

module.exports = {
  getCourses,
  getCourseById,
  getProgress,
  updateProgress,
};
