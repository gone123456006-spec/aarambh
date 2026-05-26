const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

const UPLOAD_DIRS = {
  root: UPLOAD_ROOT,
  videos: path.join(UPLOAD_ROOT, 'videos'),
  pdfs: path.join(UPLOAD_ROOT, 'pdfs'),
  avatars: path.join(UPLOAD_ROOT, 'avatars'),
};

/** Time before uploaded video/PDF URLs are exposed to the app */
const MEDIA_AVAILABLE_DELAY_MS = 30 * 1000;

function ensureUploadDirs() {
  Object.values(UPLOAD_DIRS).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function resolveBaseUrl(req) {
  const { getPublicBaseUrl } = require('./env');
  const fromEnv = getPublicBaseUrl();
  if (fromEnv) return fromEnv;

  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return `${protocol}://${req.get('host')}`;
  }

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function buildPublicUploadUrl(req, subpath) {
  const base = resolveBaseUrl(req).replace(/\/$/, '');
  const normalized = subpath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${base}/uploads/${normalized}`;
}

function buildUploadPayload(req, subpath) {
  const availableAt = new Date(Date.now() + MEDIA_AVAILABLE_DELAY_MS);
  return {
    url: buildPublicUploadUrl(req, subpath),
    path: subpath.replace(/\\/g, '/'),
    availableAt: availableAt.toISOString(),
    availableInSeconds: MEDIA_AVAILABLE_DELAY_MS / 1000,
  };
}

function deleteFileByUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes('/uploads/')) return;

  const relative = fileUrl.split('/uploads/')[1];
  if (!relative) return;

  const fullPath = path.join(UPLOAD_ROOT, relative);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

module.exports = {
  UPLOAD_DIRS,
  UPLOAD_ROOT,
  MEDIA_AVAILABLE_DELAY_MS,
  ensureUploadDirs,
  resolveBaseUrl,
  buildPublicUploadUrl,
  buildUploadPayload,
  deleteFileByUrl,
};
