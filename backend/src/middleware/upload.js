const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { MAX_FILE_SIZES } = require('../utils/constants');
const { UPLOAD_DIRS, ensureUploadDirs } = require('../config/uploads');

ensureUploadDirs();

function makeDiskStorage(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDirs();
      cb(null, folder);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${base}-${unique}${ext}`);
    },
  });
}

function videoFilter(_req, file, cb) {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only video files are allowed'), false);
  }
}

function pdfFilter(_req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only PDF files are allowed'), false);
  }
}

function imageFilter(_req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files are allowed'), false);
  }
}

const HERO_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function heroFilter(_req, file, cb) {
  if (HERO_MIME_TO_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Use a JPG, PNG, WebP, or GIF image'), false);
  }
}

function makeHeroStorage() {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDirs();
      cb(null, UPLOAD_DIRS.hero);
    },
    filename: (_req, file, cb) => {
      const ext = HERO_MIME_TO_EXT[file.mimetype] || '.jpg';
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `home-hero-${unique}${ext}`);
    },
  });
}

const uploadVideo = multer({
  storage: makeDiskStorage(UPLOAD_DIRS.videos),
  fileFilter: videoFilter,
  limits: { fileSize: MAX_FILE_SIZES.video },
});

const uploadPdf = multer({
  storage: makeDiskStorage(UPLOAD_DIRS.pdfs),
  fileFilter: pdfFilter,
  limits: { fileSize: MAX_FILE_SIZES.pdf },
});

const uploadAvatar = multer({
  storage: makeDiskStorage(UPLOAD_DIRS.avatars),
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZES.image },
});

const uploadHero = multer({
  storage: makeHeroStorage(),
  fileFilter: heroFilter,
  limits: { fileSize: MAX_FILE_SIZES.hero || MAX_FILE_SIZES.image, files: 1 },
});

module.exports = {
  uploadVideo,
  uploadPdf,
  uploadAvatar,
  uploadHero,
};
