const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { UPLOAD_ROOT, relativeUploadPath } = require('./uploads');

const BUCKET_NAME = 'uploads';
const filenameCache = new Set();

/** Emergency only — never used in production unless MEDIA_SAMPLE_HEAL=true */
const ALLOW_SAMPLE_HEAL = /^(1|true|yes)$/i.test(String(process.env.MEDIA_SAMPLE_HEAL || ''));
const HEAL_VIDEO_URL =
  process.env.MEDIA_HEAL_VIDEO_URL ||
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

let bucket = null;
let bucketDbName = null;

function normalizeGridFsName(relativePath) {
  const raw = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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
  const dbName = db.databaseName || '';
  if (!bucket || bucketDbName !== dbName) {
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
    bucketDbName = dbName;
  }
  return bucket;
}

function assertGridFsReady() {
  const gfs = getBucket();
  if (!gfs) {
    throw new Error('MongoDB GridFS is not ready — cannot store media');
  }
  return gfs;
}

function cachedHas(relativePath) {
  return filenameCache.has(normalizeGridFsName(relativePath));
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
  const normalized = normalizeGridFsName(relativePath);
  if (!normalized) return null;
  const files = await gfs.find({ filename: normalized }).limit(1).toArray();
  if (files[0]) {
    filenameCache.add(normalized);
    return files[0];
  }
  filenameCache.delete(normalized);
  return null;
}

async function deleteByFilename(relativePath) {
  const normalized = normalizeGridFsName(relativePath);
  const gfs = getBucket();
  if (!gfs || !normalized) return;
  const files = await gfs.find({ filename: normalized }).toArray();
  await Promise.all(files.map((file) => gfs.delete(file._id)));
  filenameCache.delete(normalized);
}

async function putBuffer(relativePath, buffer, contentType, metadata = {}) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid GridFS buffer upload');
  }
  const gfs = assertGridFsReady();

  await deleteByFilename(normalized);

  await new Promise((resolve, reject) => {
    const write = gfs.openUploadStream(normalized, {
      contentType: guessContentType(normalized, contentType),
      metadata: { relativePath: normalized, ...metadata },
    });
    write.on('error', reject);
    write.on('finish', resolve);
    write.end(buffer);
  });

  const verified = await findByFilename(normalized);
  if (!verified) {
    throw new Error(`GridFS write did not persist for ${normalized}`);
  }
  return verified;
}

async function putFileFromDisk(relativePath, absPath, contentType) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized || !absPath || !fs.existsSync(absPath)) {
    throw new Error('Upload file is missing on disk');
  }
  const gfs = assertGridFsReady();
  const stat = fs.statSync(absPath);
  if (!stat.size) {
    throw new Error('Uploaded file is empty');
  }

  await deleteByFilename(normalized);

  await new Promise((resolve, reject) => {
    const read = fs.createReadStream(absPath);
    const write = gfs.openUploadStream(normalized, {
      contentType: guessContentType(normalized, contentType),
      metadata: {
        relativePath: normalized,
        originalBytes: stat.size,
        storedAt: new Date().toISOString(),
      },
    });
    read.on('error', reject);
    write.on('error', reject);
    write.on('finish', resolve);
    read.pipe(write);
  });

  const verified = await findByFilename(normalized);
  if (!verified) {
    throw new Error(`GridFS write did not persist for ${normalized}`);
  }
  if (verified.length !== stat.size) {
    console.warn(
      `[media] Size mismatch for ${normalized}: disk=${stat.size} gridfs=${verified.length}`
    );
  }
  return verified;
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

function publicUploadUrl(relativePath) {
  const { getPublicBaseUrl } = require('./env');
  const base =
    getPublicBaseUrl() ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://aarambh-api.onrender.com';
  return `${String(base).replace(/\/$/, '')}/uploads/${relativePath}`;
}

function isEmergencySampleUrl(url) {
  return /gtv-videos-bucket|w3\.org\/WAI\/ER\/tests\/xhtml\/testfiles\/resources\/pdf/i.test(
    String(url || '')
  );
}

/**
 * Production media repair:
 * - migrate any leftover disk files into GridFS
 * - canonicalize lesson URLs to the public host
 * - clear stuck future availableAt gates
 * - report missing /uploads files (admin must re-upload)
 * - sample heal only if MEDIA_SAMPLE_HEAL=true (not for real production content)
 */
async function healMissingLessonMedia() {
  const Course = require('../models/Course');
  const courses = await Course.find({});
  let healedVideo = 0;
  let healedPdf = 0;
  let missingVideo = 0;
  let missingPdf = 0;
  let canonicalized = 0;

  for (const course of courses) {
    let dirty = false;

    for (const lesson of course.lessons || []) {
      if (lesson.videoAvailableAt && new Date(lesson.videoAvailableAt).getTime() > Date.now() + 60_000) {
        lesson.videoAvailableAt = new Date();
        dirty = true;
      }
      if (lesson.pdfAvailableAt && new Date(lesson.pdfAvailableAt).getTime() > Date.now() + 60_000) {
        lesson.pdfAvailableAt = new Date();
        dirty = true;
      }

      if (lesson.videoUrl) {
        const before = lesson.videoUrl;
        const rel = relativeUploadPath(lesson.videoUrl);
        if (rel) {
          const next = publicUploadUrl(rel);
          if (next !== before) {
            lesson.videoUrl = next;
            canonicalized += 1;
            dirty = true;
          }
          const exists = Boolean(await findByFilename(rel));
          if (!exists) {
            missingVideo += 1;
            if (ALLOW_SAMPLE_HEAL && rel.startsWith('videos/')) {
              try {
                const res = await fetch(HEAL_VIDEO_URL);
                const buf = Buffer.from(await res.arrayBuffer());
                await putBuffer(rel, buf, 'video/mp4', { sampleHeal: true });
                lesson.videoUrl = publicUploadUrl(rel);
                lesson.videoAvailableAt = new Date();
                healedVideo += 1;
                missingVideo -= 1;
                dirty = true;
              } catch (error) {
                console.warn(`[media] Sample video heal failed for ${rel}:`, error.message);
              }
            }
          }
        }
      }

      if (lesson.pdfUrl) {
        const before = lesson.pdfUrl;
        const rel = relativeUploadPath(lesson.pdfUrl);
        if (rel) {
          const next = publicUploadUrl(rel);
          if (next !== before) {
            lesson.pdfUrl = next;
            canonicalized += 1;
            dirty = true;
          }
          const exists = Boolean(await findByFilename(rel));
          if (!exists) {
            missingPdf += 1;
          }
        }
      }
    }

    if (dirty) {
      course.markModified('lessons');
      await course.save();
    }
  }

  if (missingVideo || missingPdf) {
    console.warn(
      `[media] Production media gaps: missingVideo=${missingVideo} missingPdf=${missingPdf}. Re-upload from admin.`
    );
  }

  return { healedVideo, healedPdf, missingVideo, missingPdf, canonicalized };
}

async function initMediaStore() {
  try {
    assertGridFsReady();
    await refreshFilenameCache();
    const migrated = await migrateDiskUploads();
    const healed = await healMissingLessonMedia();
    console.log(
      `[media] Production GridFS ready (${filenameCache.size} files` +
        `${migrated ? `, migrated ${migrated}` : ''}` +
        `${healed.canonicalized ? `, canonicalized ${healed.canonicalized}` : ''}` +
        `${healed.missingVideo || healed.missingPdf ? `, missing v=${healed.missingVideo} p=${healed.missingPdf}` : ''})`
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
  const relative =
    relativeUploadPath(urlOrPath) ||
    String(urlOrPath).replace(/\\/g, '/').replace(/^\/+/, '');
  return cachedHas(relative);
}

function mediaStats() {
  return {
    storage: 'gridfs',
    bucket: BUCKET_NAME,
    files: filenameCache.size,
    sampleHealEnabled: ALLOW_SAMPLE_HEAL,
    sample: [...filenameCache].slice(0, 20),
  };
}

module.exports = {
  initMediaStore,
  putFileFromDisk,
  putBuffer,
  deleteByFilename,
  gridFsHas,
  cachedHas,
  findByFilename,
  tryStreamGridFs,
  guessContentType,
  refreshFilenameCache,
  healMissingLessonMedia,
  mediaStats,
  assertGridFsReady,
  publicUploadUrl,
  isEmergencySampleUrl,
};
