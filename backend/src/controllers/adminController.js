const User = require('../models/User');
const Course = require('../models/Course');
const ChatSession = require('../models/ChatSession');
const uploadService = require('../services/uploadService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get aggregated dashboard statistics
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, activeUsers, totalCourses, activeChatSessions] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ isOnline: true }),
    Course.countDocuments({}),
    ChatSession.countDocuments({ status: 'active' }),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalUsers,
        activeUsers,
        totalCourses,
        activeChatSessions,
      },
      'Dashboard stats retrieved successfully'
    )
  );
});

/**
 * Get paginated list of users
 */
const getUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  const skip = (page - 1) * limit;

  const users = await User.find({ role: 'user' })
    .select('-refreshTokens')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments({ role: 'user' });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
      'Users retrieved successfully'
    )
  );
});

/**
 * Create a new course containing lessons
 */
const createCourse = asyncHandler(async (req, res) => {
  const { title, subtitle, level, color, videoSource, lessons } = req.body;

  const existing = await Course.findOne({ level });
  if (existing) {
    throw new ApiError(400, `A course already exists for the level: ${level}`);
  }

  const course = new Course({
    title,
    subtitle,
    level,
    color,
    videoSource,
    lessons: lessons || [],
    createdBy: req.user._id,
  });

  await course.save();

  res.status(201).json(new ApiResponse(201, course, 'Course created successfully'));
});

/**
 * Update an existing course details
 */
const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, subtitle, color, videoSource, lessons } = req.body;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  if (title !== undefined) course.title = title;
  if (subtitle !== undefined) course.subtitle = subtitle;
  if (color !== undefined) course.color = color;
  if (videoSource !== undefined) course.videoSource = videoSource;
  if (lessons !== undefined) course.lessons = lessons;

  await course.save();

  res.status(200).json(new ApiResponse(200, course, 'Course updated successfully'));
});

/**
 * Add a new lesson to an existing course
 */
const addLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    duration,
    description,
    type,
    pdfTitle,
    videoUrl,
    pdfUrl,
    videoAvailableAt,
    pdfAvailableAt,
  } = req.body;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const newLesson = {
    title,
    duration,
    description,
    type: type || 'video',
    pdfTitle,
    videoUrl,
    pdfUrl,
    videoAvailableAt,
    pdfAvailableAt,
    order: course.lessons.length,
  };

  course.lessons.push(newLesson);
  await course.save();

  res.status(201).json(new ApiResponse(201, course, 'Lesson added successfully'));
});

/**
 * Delete course and local upload files
 */
const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  for (const lesson of course.lessons) {
    if (lesson.videoUrl) uploadService.deleteLocalAsset(lesson.videoUrl);
    if (lesson.pdfUrl) uploadService.deleteLocalAsset(lesson.pdfUrl);
  }

  await Course.findByIdAndDelete(id);

  res.status(200).json(new ApiResponse(200, null, 'Course deleted successfully'));
});

/**
 * Upload lesson video (local disk). Available in app after 30 seconds.
 */
const uploadVideo = asyncHandler(async (req, res) => {
  const payload = uploadService.saveLessonVideo(req);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ...payload,
        videoUrl: payload.url,
        videoAvailableAt: payload.availableAt,
      },
      `Video uploaded. Available in app in ${payload.availableInSeconds} seconds.`
    )
  );
});

/**
 * Upload lesson PDF (local disk). Available in app after 30 seconds.
 */
const uploadPdf = asyncHandler(async (req, res) => {
  const payload = uploadService.saveLessonPdf(req);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ...payload,
        pdfUrl: payload.url,
        pdfAvailableAt: payload.availableAt,
      },
      `PDF uploaded. Available in app in ${payload.availableInSeconds} seconds.`
    )
  );
});

/**
 * Get granular analytics data
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const courses = await Course.find({}).select('title level views lessons');
  const courseViews = courses.map((c) => ({
    title: c.title,
    level: c.level,
    views: c.views,
    lessonsCount: c.lessons.length,
  }));

  const levelDistribution = await User.aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$level', count: { $sum: 1 } } },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        courseViews,
        levelDistribution,
      },
      'Analytics retrieved successfully'
    )
  );
});

module.exports = {
  getDashboardStats,
  getUsers,
  createCourse,
  updateCourse,
  addLesson,
  deleteCourse,
  uploadVideo,
  uploadPdf,
  getAnalytics,
};
