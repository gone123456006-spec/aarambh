const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

const UPLOAD_DIRS = {
  root: UPLOAD_ROOT,
  videos: path.join(UPLOAD_ROOT, 'videos'),
  pdfs: path.join(UPLOAD_ROOT, 'pdfs'),
  avatars: path.join(UPLOAD_ROOT, 'avatars'),
  hero: path.join(UPLOAD_ROOT, 'hero'),
};

/** Time before uploaded video/PDF URLs are exposed to the app
 *  (keep this short for admin workflow + quick reflection in the app)
 */
/** Immediate availability — admin uploads show in the app right away */
const MEDIA_AVAILABLE_DELAY_MS = 0;

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
  const normalized = String(subpath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('?')[0];
  return `${base}/uploads/${normalized}`;
}

function relativeUploadPath(fileUrl) {
  if (!fileUrl) return null;
  const raw = String(fileUrl).replace(/\\/g, '/');
  const marker = '/uploads/';
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    if (!raw.includes('://') && raw.startsWith('hero/')) return raw.split('?')[0];
    return null;
  }
  return raw.slice(idx + marker.length).split('?')[0];
}

function resolveUploadFilePath(relativePath) {
  const normalized = String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('?')[0];
  if (!normalized || normalized.includes('..')) return null;
  const fullPath = path.resolve(UPLOAD_ROOT, normalized);
  const root = path.resolve(UPLOAD_ROOT) + path.sep;
  if (!fullPath.startsWith(root) && fullPath !== path.resolve(UPLOAD_ROOT)) return null;
  return fullPath;
}

function mediaFileExists(url) {
  if (!url) return false;
  const relative = relativeUploadPath(url);
  if (!relative) return false;
  const fullPath = resolveUploadFilePath(relative);
  return Boolean(fullPath && fs.existsSync(fullPath));
}

function deleteFileByUrl(fileUrl) {
  const relative = relativeUploadPath(fileUrl);
  if (!relative) return;
  deleteFileByRelativePath(relative);
}

function deleteFileByRelativePath(relativePath) {
  const fullPath = resolveUploadFilePath(relativePath);
  if (!fullPath) return;
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
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

module.exports = {
  UPLOAD_DIRS,
  UPLOAD_ROOT,
  MEDIA_AVAILABLE_DELAY_MS,
  ensureUploadDirs,
  resolveBaseUrl,
  buildPublicUploadUrl,
  buildUploadPayload,
  relativeUploadPath,
  resolveUploadFilePath,
  deleteFileByUrl,
  deleteFileByRelativePath,
  mediaFileExists,
};
