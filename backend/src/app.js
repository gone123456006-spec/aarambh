const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { UPLOAD_ROOT, ensureUploadDirs } = require('./config/uploads');

const { getPublicBaseUrl } = require('./config/env');
const { getCorsOptions } = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const ApiError = require('./utils/ApiError');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');
const gameRoutes = require('./routes/gameRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

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

// Local uploads (videos, PDFs) — no Cloudinary
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(UPLOAD_ROOT)
);

// Apply global rate limiting for general API calls
app.use('/api', apiLimiter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Public legal pages (required HTTPS URLs for Google Play Console)
const legalDir = path.join(__dirname, '..', 'public', 'legal');
app.get('/privacy-policy', (req, res) => {
  res.type('html').sendFile(path.join(legalDir, 'privacy-policy.html'));
});
app.get('/terms-and-conditions', (req, res) => {
  res.type('html').sendFile(path.join(legalDir, 'terms-and-conditions.html'));
});

// OTP (also at /api/auth/send-otp for the mobile app)
app.post('/send-otp', ...authRoutes.sendOtpHandlers);

// Mounting API Sub-Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Fallback 404 Route for Unrecognized Endpoints
app.use('*', (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
