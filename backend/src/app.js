const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { UPLOAD_ROOT, ensureUploadDirs, resolveUploadFilePath } = require('./config/uploads');

const { getPublicBaseUrl } = require('./config/env');
const { privacyPolicyHtml, termsHtml } = require('./content/legalPages');
const { getCorsOptions } = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const subscriptionController = require('./controllers/subscriptionController');
const ApiError = require('./utils/ApiError');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');
const gameRoutes = require('./routes/gameRoutes');
const gameQuestionRoutes = require('./routes/gameQuestionRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const appRoutes = require('./routes/appRoutes');

const app = express();

// Render / reverse proxy (rate limit + client IP)
app.set('trust proxy', 1);

ensureUploadDirs();

// Security Headers (allow mobile app to load /uploads videos & PDFs)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors(getCorsOptions()));

// Razorpay webhooks need the raw body for HMAC verification (before JSON parser).
app.post(
  '/api/subscription/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleRazorpayWebhook
);

// HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Service root (Render health + quick sanity check)
app.get('/', (req, res) => {
  const base = getPublicBaseUrl() || `${req.protocol}://${req.get('host')}`;
  res.status(200).json({
    success: true,
    service: 'aarambh-api',
    health: `${base}/health`,
    api: `${base}/api`,
    admin: `${base}/admin/`,
  });
});

// Body parsers & Cookie parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Admin web dashboard — no-cache so deploys show new login UI immediately
app.use(
  '/admin',
  (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  },
  express.static(path.join(__dirname, '..', 'public', 'admin'), {
    index: 'index.html',
    etag: true,
    lastModified: true,
  })
);

// Persistent uploads: disk cache first, then MongoDB GridFS (survives Render deploys)
app.use('/uploads', async (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    return res.status(204).end();
  }

  const relative = decodeURIComponent(String(req.path || ''))
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const diskPath = resolveUploadFilePath(relative);
  if (diskPath && fs.existsSync(diskPath)) {
    return next();
  }

  try {
    const { tryStreamGridFs } = require('./config/gridfsMedia');
    const streamed = await tryStreamGridFs(req, res, relative);
    if (streamed) return;
  } catch (error) {
    console.warn('[media] GridFS stream failed:', error.message);
  }
  next();
}, express.static(UPLOAD_ROOT));

// Apply global rate limiting for general API calls
app.use('/api', apiLimiter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  const { isFirebaseEnabled } = require('./services/firebaseService');
  let media = { files: 0 };
  try {
    media = require('./config/gridfsMedia').mediaStats();
  } catch {
    /* ignore */
  }
  res.status(200).json({
    success: true,
    status: 'UP',
    timestamp: new Date(),
    uptime: process.uptime(),
    firebase: isFirebaseEnabled() ? 'enabled' : 'disabled',
    mediaFiles: media.files,
  });
});

/** Diagnose / optionally repair lesson media (used after Render disk wipe). */
app.get('/health/media', async (req, res) => {
  try {
    const Course = require('./models/Course');
    const { mediaStats, healMissingLessonMedia, refreshFilenameCache, cachedHas } = require('./config/gridfsMedia');
    const { relativeUploadPath } = require('./config/uploads');

    if (String(req.query.repair || '') === '1') {
      const healed = await healMissingLessonMedia();
      await refreshFilenameCache();
      return res.json({
        success: true,
        repaired: true,
        healed,
        media: mediaStats(),
      });
    }

    const courses = await Course.find({}).lean();
    const lessons = [];
    for (const c of courses) {
      for (const l of c.lessons || []) {
        const videoRel = relativeUploadPath(l.videoUrl);
        const pdfRel = relativeUploadPath(l.pdfUrl);
        lessons.push({
          course: c.level,
          title: l.title,
          videoUrl: l.videoUrl || null,
          pdfUrl: l.pdfUrl || null,
          videoInGridFs: videoRel ? cachedHas(videoRel) : false,
          pdfInGridFs: pdfRel ? cachedHas(pdfRel) : false,
          videoIsRemote: /^https?:\/\//i.test(String(l.videoUrl || '')) && !String(l.videoUrl || '').includes('/uploads/'),
        });
      }
    }

    res.json({
      success: true,
      media: mediaStats(),
      lessons,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public legal pages (required HTTPS URLs for Google Play Console)
app.get('/privacy-policy', (req, res) => {
  res.type('html').send(privacyPolicyHtml);
});
app.get('/terms-and-conditions', (req, res) => {
  res.type('html').send(termsHtml);
});

// OTP (also at /api/auth/send-otp for the mobile app)
app.post('/send-otp', ...authRoutes.sendOtpHandlers);

// Mounting API Sub-Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/game-questions', gameQuestionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/app', appRoutes);

// Fallback 404 Route for Unrecognized Endpoints
app.use('*', (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
