const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');
const ChatSession = require('../models/ChatSession');
const CourseProgress = require('../models/CourseProgress');
const GameProgress = require('../models/GameProgress');
const uploadService = require('../services/uploadService');
const tokenService = require('../services/tokenService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Admin dashboard login — username + password only (no Gmail / OTP)
 */
const adminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password) {
    throw new ApiError(400, 'User ID and password are required');
  }

  const expectedUsername = process.env.ADMIN_USERNAME?.trim();
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminDbEmail =
    process.env.ADMIN_DB_EMAIL?.trim() || 'aarambh-admin@system.local';

  if (!expectedUsername || !expectedPassword) {
    throw new ApiError(
      500,
      'Admin login not configured (set ADMIN_USERNAME and ADMIN_PASSWORD in .env)'
    );
  }

  if (username.trim() !== expectedUsername || !safeCompare(password, expectedPassword)) {
    throw new ApiError(401, 'Invalid user ID or password');
  }

  let admin = await User.findOne({ role: 'admin' });

  if (!admin) {
    admin = await User.findOne({ email: adminDbEmail.toLowerCase() });
  }

  if (!admin) {
    admin = await User.create({
      email: adminDbEmail.toLowerCase(),
      name: 'Aarambh Admin',
      role: 'admin',
      profileCompleted: true,
    });
  } else if (admin.role !== 'admin') {
    admin.role = 'admin';
    await admin.save();
  }

  const accessToken = tokenService.generateAdminAccessToken(admin._id);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        user: {
          id: admin._id,
          username: expectedUsername,
          name: admin.name,
          role: admin.role,
        },
      },
      'Admin login successful'
    )
  );
});

const USER_ROLE_QUERY = { role: 'user' };

function hasSessionQuery() {
  return {
    ...USER_ROLE_QUERY,
    $expr: { $gt: [{ $size: { $ifNull: ['$refreshTokens', []] } }, 0] },
  };
}

function formatUserRow(doc) {
  const u = doc.toObject ? doc.toObject() : doc;
  const sessions = u.refreshTokens || [];
  delete u.refreshTokens;
  return {
    ...u,
    hasActiveSession: sessions.length > 0,
    sessionCount: sessions.length,
  };
}

/**
 * Get aggregated dashboard statistics
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    onlineUsers,
    loggedInUsers,
    activeLast24h,
    profileCompleted,
    newUsersThisWeek,
    totalCourses,
    activeChatSessions,
  ] = await Promise.all([
    User.countDocuments(USER_ROLE_QUERY),
    User.countDocuments({ ...USER_ROLE_QUERY, isOnline: true }),
    User.countDocuments(hasSessionQuery()),
    User.countDocuments({ ...USER_ROLE_QUERY, lastSeen: { $gte: last24h } }),
    User.countDocuments({ ...USER_ROLE_QUERY, profileCompleted: true }),
    User.countDocuments({ ...USER_ROLE_QUERY, createdAt: { $gte: last7d } }),
    Course.countDocuments({}),
    ChatSession.countDocuments({ status: 'active' }),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalUsers,
        onlineUsers,
        loggedInUsers,
        activeLast24h,
        profileCompleted,
        newUsersThisWeek,
        totalCourses,
        activeChatSessions,
        // legacy alias
        activeUsers: onlineUsers,
      },
      'Dashboard stats retrieved successfully'
    )
  );
});

/**
 * Get paginated list of users with search & filters
 */
const getUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;
  const search = req.query.search?.trim();
  const filter = req.query.filter || 'all';

  const query = { ...USER_ROLE_QUERY };

  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  if (filter === 'online') {
    query.isOnline = true;
  } else if (filter === 'logged_in') {
    Object.assign(query, {
      $expr: { $gt: [{ $size: { $ifNull: ['$refreshTokens', []] } }, 0] },
    });
  } else if (filter === 'profile_complete') {
    query.profileCompleted = true;
  }

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        users: users.map(formatUserRow),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
      'Users retrieved successfully'
    )
  );
});

/**
 * Single user detail + learning progress
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'user' });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const [courseProgress, gameProgress] = await Promise.all([
    CourseProgress.findOne({ user: user._id }).lean(),
    GameProgress.find({ user: user._id }).select('gameId level score completed stats').lean(),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: formatUserRow(user),
        courseProgress: courseProgress || { completedLessons: [], lastLessonId: null },
        gameProgress,
      },
      'User details retrieved successfully'
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
 * Delete a single lesson's media (video or pdf) from a course.
 * Route: DELETE /api/admin/courses/:courseId/lessons/:lessonId/media?kind=video|pdf
 */
const deleteLessonMedia = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;
  const kind = String(req.query.kind ?? '').toLowerCase();

  if (!kind || !['video', 'pdf'].includes(kind)) {
    throw new ApiError(400, 'kind query param is required: kind=video or kind=pdf');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const lesson = course.lessons?.id(lessonId);
  if (!lesson) {
    throw new ApiError(404, 'Lesson not found');
  }

  if (kind === 'video') {
    if (lesson.videoUrl) uploadService.deleteLocalAsset(lesson.videoUrl);
    lesson.videoUrl = undefined;
    lesson.videoAvailableAt = undefined;
  } else {
    if (lesson.pdfUrl) uploadService.deleteLocalAsset(lesson.pdfUrl);
    lesson.pdfUrl = undefined;
    lesson.pdfAvailableAt = undefined;
  }

  await course.save();

  res.status(200).json(
    new ApiResponse(200, { courseId, lessonId, kind, lesson }, 'Lesson media deleted successfully')
  );
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
  adminLogin,
  getDashboardStats,
  getUsers,
  getUserById,
  createCourse,
  updateCourse,
  addLesson,
  deleteCourse,
  deleteLessonMedia,
  uploadVideo,
  uploadPdf,
  getAnalytics,
};
