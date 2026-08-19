const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');
const ChatSession = require('../models/ChatSession');
const CourseProgress = require('../models/CourseProgress');
const GameProgress = require('../models/GameProgress');
const uploadService = require('../services/uploadService');
const tokenService = require('../services/tokenService');
const { sortCourseLessons, slugifyLevel, colorsForLevel } = require('../constants/curriculum');
const { notifyNewCourse, notifyCourseLessonsAdded } = require('../services/notificationHelpers');
const {
  getLessonAppStatus,
  normalizeMediaAvailabilityOnSave,
  assertMediaFilesExist,
} = require('../utils/lessonMedia');
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
 * Get aggregated dashboard statistics including subscriptions and revenue
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const Subscription = require('../models/Subscription');

  const [
    totalUsers,
    onlineUsers,
    loggedInUsers,
    activeLast24h,
    profileCompleted,
    newUsersThisWeek,
    totalCourses,
    activeChatSessions,
    activeSubscriptions,
    expiredSubscriptions,
    totalSubscriptions,
    recentSubscriptions,
  ] = await Promise.all([
    User.countDocuments(USER_ROLE_QUERY),
    User.countDocuments({ ...USER_ROLE_QUERY, isOnline: true }),
    User.countDocuments(hasSessionQuery()),
    User.countDocuments({ ...USER_ROLE_QUERY, lastSeen: { $gte: last24h } }),
    User.countDocuments({ ...USER_ROLE_QUERY, profileCompleted: true }),
    User.countDocuments({ ...USER_ROLE_QUERY, createdAt: { $gte: last7d } }),
    Course.countDocuments({}),
    ChatSession.countDocuments({ status: 'active' }),
    Subscription.countDocuments({ status: 'active', expiryDate: { $gt: now } }),
    Subscription.countDocuments({ status: 'expired' }),
    Subscription.countDocuments({}),
    Subscription.countDocuments({ purchaseDate: { $gte: last30d }, paymentStatus: 'completed' }),
  ]);

  // Calculate revenue
  const revenueStats = await Subscription.aggregate([
    { $match: { paymentStatus: 'completed' } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$price' },
        completedPayments: { $sum: 1 },
      },
    },
  ]);

  const revenueThisMonth = await Subscription.aggregate([
    { 
      $match: { 
        paymentStatus: 'completed',
        purchaseDate: { $gte: last30d },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$price' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Active learners (users with course progress)
  const activeLearners = await CourseProgress.countDocuments({
    updatedAt: { $gte: last7d },
  });

  // Enrolled courses count (users with any course progress)
  const enrolledCourses = await CourseProgress.countDocuments({});

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
        activeUsers: onlineUsers,
        // Subscription stats
        activeSubscriptions,
        expiredSubscriptions,
        totalSubscriptions,
        recentSubscriptions,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        revenueThisMonth: revenueThisMonth[0]?.revenue || 0,
        revenueTransactions: revenueStats[0]?.completedPayments || 0,
        revenueTransactionsThisMonth: revenueThisMonth[0]?.count || 0,
        // Learning stats
        activeLearners,
        enrolledCourses,
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
 * Single user detail + learning progress + subscription + courses
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'user' });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const Subscription = require('../models/Subscription');
  const subscriptionService = require('../services/subscriptionService');

  const [courseProgress, gameProgress, subscriptions, subscriptionSummary] = await Promise.all([
    CourseProgress.findOne({ user: user._id }).lean(),
    GameProgress.find({ user: user._id }).select('gameId level score completed stats').lean(),
    Subscription.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
    subscriptionService.getSubscriptionSummary(user._id),
  ]);

  // Calculate course completion stats
  const courses = await Course.find({}).select('title level lessons').lean();
  const completedLessons = courseProgress?.completedLessons || [];
  const totalLessons = courses.reduce((sum, c) => sum + (c.lessons?.length || 0), 0);
  const completionPercentage = totalLessons > 0 
    ? Math.round((completedLessons.length / totalLessons) * 100)
    : 0;

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: formatUserRow(user),
        courseProgress: {
          ...(courseProgress || {}),
          completedLessons: completedLessons || [],
          lastLessonId: courseProgress?.lastLessonId || null,
          totalLessons,
          completionPercentage,
        },
        gameProgress,
        subscriptions,
        subscriptionSummary,
        courses: courses.map(c => ({
          title: c.title,
          level: c.level,
          totalLessons: c.lessons?.length || 0,
          completedInCourse: completedLessons.filter(lid => 
            c.lessons?.some(l => l.lessonKey === lid)
          ).length,
        })),
      },
      'User details retrieved successfully'
    )
  );
});

/**
 * Create a new category/course (Beginner, Intermediate, Advanced, or custom).
 */
const createCourse = asyncHandler(async (req, res) => {
  const { title, subtitle, color, videoSource, lessons } = req.body;
  let level = slugifyLevel(req.body.level || title);

  if (!level) {
    throw new ApiError(400, 'Category name / level is required');
  }
  if (!title?.trim()) {
    throw new ApiError(400, 'Course title is required');
  }

  const existing = await Course.findOne({ level });
  if (existing) {
    throw new ApiError(400, `A category already exists for: ${level}`);
  }

  const count = await Course.countDocuments({});
  const course = new Course({
    title: title.trim(),
    subtitle: subtitle?.trim() || `${title.trim()} lessons`,
    level,
    color: Array.isArray(color) && color.length ? color : colorsForLevel(level, count),
    videoSource,
    lessons: lessons || [],
    sortOrder: count,
    createdBy: req.user._id,
  });

  await course.save();

  // Send push notification about new course (async, don't wait)
  notifyNewCourse(course).catch((err) => 
    console.error('Failed to send new course notification:', err)
  );

  res.status(201).json(new ApiResponse(201, course, 'Category created successfully'));
});

/**
 * Update an existing course details
 */
const updateCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, subtitle, color, videoSource, lessons, sortOrder } = req.body;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  if (title !== undefined) course.title = title;
  if (subtitle !== undefined) course.subtitle = subtitle;
  if (color !== undefined) course.color = color;
  if (videoSource !== undefined) course.videoSource = videoSource;
  if (lessons !== undefined) course.lessons = lessons;
  if (sortOrder !== undefined) course.sortOrder = sortOrder;

  await course.save();

  res.status(200).json(new ApiResponse(200, course, 'Course updated successfully'));
});

/**
 * Add a new lesson (title, about, duration, video, PDF) to a category.
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

  if (!title?.trim()) {
    throw new ApiError(400, 'Lesson title is required');
  }

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const order = course.lessons.length;
  const lessonKey =
    req.body.lessonKey?.trim() ||
    `${course.level}-${order + 1}-${Date.now().toString(36)}`;

  const newLesson = {
    title: title.trim(),
    duration: duration?.trim() || '0:00',
    description: description?.trim() || '',
    type: type || 'video',
    pdfTitle: pdfTitle?.trim() || (title.trim() + ' notes'),
    videoUrl,
    pdfUrl,
    videoAvailableAt,
    pdfAvailableAt,
    lessonKey,
    order,
  };

  course.lessons.push(newLesson);
  course.lessons = sortCourseLessons(course.lessons);
  await course.save();

  // Send push notification about new lesson (async, don't wait)
  notifyCourseLessonsAdded(course, 1).catch((err) => 
    console.error('Failed to send lesson notification:', err)
  );

  res.status(201).json(new ApiResponse(201, course, 'Lesson added successfully'));
});

/**
 * List all courses for admin (includes pending media URLs).
 */
const getAdminCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
  for (const c of courses) {
    c.lessons = sortCourseLessons(c.lessons || []).map((lesson) => ({
      ...lesson,
      appStatus: getLessonAppStatus(lesson),
    }));
  }
  res.status(200).json(new ApiResponse(200, courses, 'Courses retrieved successfully'));
});

/**
 * Create or update a lesson. Prefer lessonId for updates; lessonKey for upsert by key.
 */
const upsertLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    lessonId,
    lessonKey,
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

  if (!title?.trim()) {
    throw new ApiError(400, 'Lesson title is required');
  }

  const course = await Course.findById(id);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  let lesson = null;
  if (lessonId) {
    lesson = course.lessons.id(lessonId);
  } else if (lessonKey?.trim()) {
    lesson = course.lessons.find((l) => l.lessonKey === lessonKey.trim());
  }

  if (lesson) {
    if (videoUrl && lesson.videoUrl && lesson.videoUrl !== videoUrl) {
      uploadService.deleteLocalAsset(lesson.videoUrl);
    }
    if (pdfUrl && lesson.pdfUrl && lesson.pdfUrl !== pdfUrl) {
      uploadService.deleteLocalAsset(lesson.pdfUrl);
    }
    lesson.title = title.trim();
    if (duration !== undefined) lesson.duration = duration?.trim() || '0:00';
    if (description !== undefined) lesson.description = description?.trim() || '';
    lesson.type = type || 'video';
    if (pdfTitle !== undefined) lesson.pdfTitle = pdfTitle?.trim() || '';
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl || undefined;
    if (pdfUrl !== undefined) lesson.pdfUrl = pdfUrl || undefined;
  } else {
    const order = course.lessons.length;
    const key =
      lessonKey?.trim() || `${course.level}-${order + 1}-${Date.now().toString(36)}`;
    course.lessons.push({
      lessonKey: key,
      title: title.trim(),
      duration: duration?.trim() || '0:00',
      description: description?.trim() || '',
      type: type || 'video',
      pdfTitle: pdfTitle?.trim() || `${title.trim()} notes`,
      videoUrl,
      pdfUrl,
      order,
    });
    lesson = course.lessons[course.lessons.length - 1];
  }

  const nextVideoUrl = lesson.videoUrl;
  const nextPdfUrl = lesson.pdfUrl;

  if ((type || 'video') === 'video' && !nextVideoUrl && !nextPdfUrl) {
    throw new ApiError(400, 'Add a video or PDF file for this lesson');
  }

  try {
    assertMediaFilesExist({ videoUrl: nextVideoUrl, pdfUrl: nextPdfUrl });
  } catch (error) {
    throw new ApiError(400, error.message);
  }

  const availability = normalizeMediaAvailabilityOnSave({
    videoUrl: nextVideoUrl,
    pdfUrl: nextPdfUrl,
    videoAvailableAt,
    pdfAvailableAt,
  });
  lesson.videoAvailableAt = availability.videoAvailableAt;
  lesson.pdfAvailableAt = availability.pdfAvailableAt;

  course.lessons = sortCourseLessons(course.lessons);
  await course.save();

  const savedLesson = course.lessons.id(lesson._id) || lesson;
  const appStatus = getLessonAppStatus(savedLesson);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        courseId: course._id,
        lesson: savedLesson,
        appStatus,
      },
      appStatus.appReady
        ? 'Lesson saved — visible in the app now'
        : 'Lesson saved — still processing for the app'
    )
  );
});

/**
 * Update an existing lesson by Mongo id (title, about, duration, media).
 */
const updateLesson = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;
  const {
    title,
    duration,
    description,
    pdfTitle,
    videoUrl,
    pdfUrl,
    videoAvailableAt,
    pdfAvailableAt,
  } = req.body;

  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');

  const lesson = course.lessons.id(lessonId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  if (title !== undefined) lesson.title = title.trim();
  if (duration !== undefined) lesson.duration = duration?.trim() || '0:00';
  if (description !== undefined) lesson.description = description?.trim() || '';
  if (pdfTitle !== undefined) lesson.pdfTitle = pdfTitle?.trim() || '';

  if (videoUrl !== undefined) {
    if (videoUrl && lesson.videoUrl && lesson.videoUrl !== videoUrl) {
      uploadService.deleteLocalAsset(lesson.videoUrl);
    }
    lesson.videoUrl = videoUrl || undefined;
    if (videoAvailableAt !== undefined) lesson.videoAvailableAt = videoAvailableAt || undefined;
  }
  if (pdfUrl !== undefined) {
    if (pdfUrl && lesson.pdfUrl && lesson.pdfUrl !== pdfUrl) {
      uploadService.deleteLocalAsset(lesson.pdfUrl);
    }
    lesson.pdfUrl = pdfUrl || undefined;
    if (pdfAvailableAt !== undefined) lesson.pdfAvailableAt = pdfAvailableAt || undefined;
  }

  await course.save();
  res.status(200).json(new ApiResponse(200, course, 'Lesson updated successfully'));
});

/**
 * Delete an entire lesson (and its media files).
 */
const deleteLesson = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const lesson = course.lessons?.id(lessonId);
  if (!lesson) {
    throw new ApiError(404, 'Lesson not found');
  }

  if (lesson.videoUrl) uploadService.deleteLocalAsset(lesson.videoUrl);
  if (lesson.pdfUrl) uploadService.deleteLocalAsset(lesson.pdfUrl);

  course.lessons.pull(lessonId);
  await course.save();

  res.status(200).json(new ApiResponse(200, course, 'Lesson deleted successfully'));
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
 * Upload lesson video (local disk). Immediately available in the app after lesson save.
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
      'Video uploaded. Click “Add lesson to app” to publish it in My Courses.'
    )
  );
});

/**
 * Upload lesson PDF (local disk). Immediately available in the app after lesson save.
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
      'PDF uploaded. Click “Add lesson to app” to publish it in My Courses.'
    )
  );
});

/**
 * Check whether a lesson is visible/ playable in the mobile app.
 */
const getLessonAppStatusHandler = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');

  const lesson = course.lessons.id(lessonId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  res.status(200).json(
    new ApiResponse(200, getLessonAppStatus(lesson), 'Lesson app status retrieved')
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

/**
 * Get all subscriptions with pagination and filters
 */
const getSubscriptions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const skip = (page - 1) * limit;
  const status = req.query.status;
  const paymentStatus = req.query.paymentStatus;

  const Subscription = require('../models/Subscription');

  const query = {};
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  const [subscriptions, total] = await Promise.all([
    Subscription.find(query)
      .populate('user', 'name email phone region level avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Subscription.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        subscriptions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
      'Subscriptions retrieved successfully'
    )
  );
});

/**
 * Get subscription by ID
 */
const getSubscriptionById = asyncHandler(async (req, res) => {
  const Subscription = require('../models/Subscription');
  
  const subscription = await Subscription.findById(req.params.id)
    .populate('user', 'name email phone region level avatar')
    .lean();

  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  res.status(200).json(
    new ApiResponse(200, subscription, 'Subscription retrieved successfully')
  );
});

/**
 * Update subscription status (for manual admin actions)
 */
const updateSubscriptionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const Subscription = require('../models/Subscription');

  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  if (status !== undefined) {
    subscription.status = status;
  }

  await subscription.save();

  res.status(200).json(
    new ApiResponse(200, subscription, 'Subscription updated successfully')
  );
});

module.exports = {
  adminLogin,
  getDashboardStats,
  getUsers,
  getUserById,
  getAdminCourses,
  createCourse,
  updateCourse,
  addLesson,
  upsertLesson,
  updateLesson,
  deleteLesson,
  deleteCourse,
  deleteLessonMedia,
  uploadVideo,
  uploadPdf,
  getLessonAppStatusHandler,
  getAnalytics,
  getSubscriptions,
  getSubscriptionById,
  updateSubscriptionStatus,
};
