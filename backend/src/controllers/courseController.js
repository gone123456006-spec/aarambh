const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get all courses, grouped or sorted by level
 */
const getCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({}).sort({ createdAt: 1 });
  res.status(200).json(new ApiResponse(200, courses, 'Courses retrieved successfully'));
});

/**
 * Get single course by ID or level
 */
const getCourseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find either by MongoDB ObjectId or by unique level key
  let course;
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    course = await Course.findById(id);
  } else {
    course = await Course.findOne({ level: id });
  }

  if (!course) {
    throw new ApiError(404, `Course with identifier ${id} not found`);
  }

  // Increment views count asynchronously
  course.views += 1;
  await course.save();

  res.status(200).json(new ApiResponse(200, course, 'Course retrieved successfully'));
});

/**
 * Get the current user's course progress (completed lessons and last lesson ID)
 */
const getProgress = asyncHandler(async (req, res) => {
  let progress = await CourseProgress.findOne({ user: req.user._id });

  if (!progress) {
    // Return a default blank progress structure instead of throwing
    progress = {
      completedLessons: [],
      lastLessonId: null,
    };
  }

  res.status(200).json(new ApiResponse(200, progress, 'Course progress retrieved successfully'));
});

/**
 * Update lesson completion progress
 */
const updateProgress = asyncHandler(async (req, res) => {
  const { lessonId, isCompleted } = req.body;

  if (!lessonId) {
    throw new ApiError(400, 'Lesson ID is required');
  }

  let progress = await CourseProgress.findOne({ user: req.user._id });

  if (!progress) {
    progress = new CourseProgress({
      user: req.user._id,
      completedLessons: [],
      lastLessonId: null,
    });
  }

  const alreadyCompleted = progress.completedLessons.includes(lessonId);

  if (isCompleted === true || isCompleted === undefined) {
    // Mark as completed
    if (!alreadyCompleted) {
      progress.completedLessons.push(lessonId);
    }
    progress.lastLessonId = lessonId;
  } else if (isCompleted === false) {
    // Unmark as completed
    progress.completedLessons = progress.completedLessons.filter(id => id !== lessonId);
  }

  await progress.save();

  res.status(200).json(new ApiResponse(200, progress, 'Course progress updated successfully'));
});

module.exports = {
  getCourses,
  getCourseById,
  getProgress,
  updateProgress,
};
