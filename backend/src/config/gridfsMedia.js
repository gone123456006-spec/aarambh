const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { UPLOAD_ROOT, relativeUploadPath } = require('./uploads');

const BUCKET_NAME = 'uploads';
const filenameCache = new Set();

let bucket = null;

function guessContentType(filename, fallback) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const map = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] || fallback || 'application/octet-stream';
}

function getBucket() {
  const db = mongoose.connection?.db;
  if (!db) return null;
  if (!bucket) {
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
  }
  return bucket;
}

function cachedHas(relativePath) {
  return filenameCache.has(String(relativePath || '').replace(/\\/g, '/'));
}

async function refreshFilenameCache() {
  const gfs = getBucket();
  if (!gfs) return;
  const files = await gfs.find({}).toArray();
  filenameCache.clear();
  for (const file of files) {
    if (file.filename) filenameCache.add(file.filename);
  }
}

async function findByFilename(relativePath) {
  const gfs = getBucket();
  if (!gfs || !relativePath) return null;
  const files = await gfs.find({ filename: relativePath }).limit(1).toArray();
  return files[0] || null;
}

async function deleteByFilename(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  const gfs = getBucket();
  if (!gfs || !normalized) return;
  const files = await gfs.find({ filename: normalized }).toArray();
  await Promise.all(files.map((file) => gfs.delete(file._id)));
  filenameCache.delete(normalized);
}

async function putFileFromDisk(relativePath, absPath, contentType) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized || !absPath || !fs.existsSync(absPath)) {
    throw new Error('Upload file is missing on disk');
  }
  const gfs = getBucket();
  if (!gfs) {
    throw new Error('MongoDB is not connected; cannot persist media');
  }

  await deleteByFilename(normalized);

  await new Promise((resolve, reject) => {
    const read = fs.createReadStream(absPath);
    const write = gfs.openUploadStream(normalized, {
      contentType: guessContentType(normalized, contentType),
      metadata: { relativePath: normalized },
    });
    read.on('error', reject);
    write.on('error', reject);
    write.on('finish', resolve);
    read.pipe(write);
  });

  filenameCache.add(normalized);
}

async function migrateDiskUploads() {
  const gfs = getBucket();
  if (!gfs || !fs.existsSync(UPLOAD_ROOT)) return 0;

  let migrated = 0;
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return [];
    const entries = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) {
        entries.push(...walk(full, rel));
      } else {
        entries.push({ full, rel: rel.replace(/\\/g, '/') });
      }
    }
    return entries;
  };

  const files = walk(UPLOAD_ROOT, '');
  for (const file of files) {
    if (cachedHas(file.rel)) continue;
    try {
      await putFileFromDisk(file.rel, file.full);
      migrated += 1;
    } catch (error) {
      console.warn(`[media] Failed to migrate ${file.rel}:`, error.message);
    }
  }
  return migrated;
}

async function initMediaStore() {
  try {
    await refreshFilenameCache();
    const migrated = await migrateDiskUploads();
    console.log(
      `[media] Persistent GridFS ready (${filenameCache.size} files${migrated ? `, migrated ${migrated} from disk` : ''})`
    );
  } catch (error) {
    console.error('[media] GridFS init failed:', error.message);
  }
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = String(rangeHeader).match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start < 0) start = 0;
  if (end >= size) end = size - 1;
  if (start > end) return null;
  return { start, end };
}

function setMediaHeaders(res) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}

async function tryStreamGridFs(req, res, relativePath) {
  const normalized = decodeURIComponent(String(relativePath || ''))
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return false;

  const file = await findByFilename(normalized);
  if (!file) return false;

  const size = file.length;
  const contentType = file.contentType || guessContentType(normalized);
  const range = parseRange(req.headers.range, size);

  setMediaHeaders(res);
  res.setHeader('Content-Type', contentType);
  if (normalized.endsWith('.pdf')) {
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(normalized)}"`);
  }

  const gfs = getBucket();
  if (!gfs) return false;

  if (req.method === 'HEAD') {
    if (range) {
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader('Content-Length', range.end - range.start + 1);
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Length', size);
    }
    res.end();
    return true;
  }

  if (range) {
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
    const stream = gfs.openDownloadStreamByName(normalized, {
      start: range.start,
      end: range.end + 1,
    });
    stream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 404;
        res.end();
      } else res.end();
    });
    stream.pipe(res);
    return true;
  }

  res.statusCode = 200;
  res.setHeader('Content-Length', size);
  const stream = gfs.openDownloadStreamByName(normalized);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 404;
      res.end();
    } else res.end();
  });
  stream.pipe(res);
  return true;
}

function gridFsHas(urlOrPath) {
  if (!urlOrPath) return false;
  const relative = relativeUploadPath(urlOrPath) || String(urlOrPath).replace(/\\/g, '/').replace(/^\/+/, '');
  return cachedHas(relative);
}

module.exports = {
  initMediaStore,
  putFileFromDisk,
  deleteByFilename,
  gridFsHas,
  cachedHas,
  tryStreamGridFs,
  guessContentType,
  refreshFilenameCache,
};
