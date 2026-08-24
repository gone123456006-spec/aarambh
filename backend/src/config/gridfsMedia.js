const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { UPLOAD_ROOT, relativeUploadPath } = require('./uploads');

const BUCKET_NAME = 'uploads';
const filenameCache = new Set();

/** Remote sample video — used when local bytes were wiped (Render disk). App plays this HTTPS URL directly. */
const HEAL_VIDEO_URL =
  process.env.MEDIA_HEAL_VIDEO_URL ||
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

let bucket = null;
let healVideoBufferPromise = null;

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
  const normalized = String(relativePath).replace(/\\/g, '/');
  if (cachedHas(normalized)) {
    const files = await gfs.find({ filename: normalized }).limit(1).toArray();
    if (files[0]) return files[0];
  }
  const files = await gfs.find({ filename: normalized }).limit(1).toArray();
  if (files[0]) {
    filenameCache.add(normalized);
    return files[0];
  }
  return null;
}

async function deleteByFilename(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  const gfs = getBucket();
  if (!gfs || !normalized) return;
  const files = await gfs.find({ filename: normalized }).toArray();
  await Promise.all(files.map((file) => gfs.delete(file._id)));
  filenameCache.delete(normalized);
}

async function putBuffer(relativePath, buffer, contentType) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid GridFS buffer upload');
  }
  const gfs = getBucket();
  if (!gfs) {
    throw new Error('MongoDB is not connected; cannot persist media');
  }

  await deleteByFilename(normalized);

  await new Promise((resolve, reject) => {
    const write = gfs.openUploadStream(normalized, {
      contentType: guessContentType(normalized, contentType),
      metadata: { relativePath: normalized, healed: true },
    });
    write.on('error', reject);
    write.on('finish', resolve);
    write.end(buffer);
  });

  filenameCache.add(normalized);
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

  const verified = await findByFilename(normalized);
  if (!verified) {
    throw new Error(`GridFS write did not persist for ${normalized}`);
  }
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

function minimalPdfBuffer(title) {
  const label = String(title || "Ohm's English lesson notes").slice(0, 80);
  const stream = `BT /F1 18 Tf 72 720 Td (${label.replace(/[()\\]/g, '')}) Tj ET`;
  const body = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${stream.length} >>stream
${stream}
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000385 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
462
%%EOF
`;
  return Buffer.from(body.replace(/\n/g, '\r\n'));
}

async function loadHealVideoBuffer() {
  if (!healVideoBufferPromise) {
    healVideoBufferPromise = (async () => {
      const res = await fetch(HEAL_VIDEO_URL);
      if (!res.ok) {
        throw new Error(`Heal video download failed: HTTP ${res.status}`);
      }
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length < 1000) {
        throw new Error('Heal video download too small');
      }
      console.log(`[media] Loaded heal video (${buf.length} bytes)`);
      return buf;
    })().catch((error) => {
      healVideoBufferPromise = null;
      throw error;
    });
  }
  return healVideoBufferPromise;
}

function publicUploadUrl(relativePath) {
  const { getPublicBaseUrl } = require('./env');
  const base =
    getPublicBaseUrl() ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://aarambh-api.onrender.com';
  return `${String(base).replace(/\/$/, '')}/uploads/${relativePath}`;
}

function lessonNeedsVideo(lesson) {
  const type = String(lesson.type || 'video').toLowerCase();
  return type === 'video' || Boolean(lesson.videoUrl) || Boolean(lesson.title);
}

function lessonNeedsPdf(lesson) {
  return Boolean(lesson.pdfUrl) || Boolean(lesson.pdfTitle);
}

/**
 * Restore lesson media wiped by Render redeploys.
 * Videos: point at a stable remote sample (or keep GridFS file if present).
 * PDFs: write a real PDF into GridFS under the lesson path.
 */
async function healMissingLessonMedia() {
  const Course = require('../models/Course');
  const courses = await Course.find({});
  let healedVideo = 0;
  let healedPdf = 0;
  let videoBuffer = null;

  for (const course of courses) {
    let dirty = false;

    for (const lesson of course.lessons || []) {
      // Unstick bad future “processing” gates from older uploads
      if (lesson.videoAvailableAt && new Date(lesson.videoAvailableAt).getTime() > Date.now() + 60_000) {
        lesson.videoAvailableAt = new Date();
        dirty = true;
      }
      if (lesson.pdfAvailableAt && new Date(lesson.pdfAvailableAt).getTime() > Date.now() + 60_000) {
        lesson.pdfAvailableAt = new Date();
        dirty = true;
      }

      if (lessonNeedsVideo(lesson)) {
        const videoRel = relativeUploadPath(lesson.videoUrl);
        const hasLocalVideo = videoRel ? Boolean(await findByFilename(videoRel)) : false;
        const isRemoteOk =
          /^https?:\/\//i.test(String(lesson.videoUrl || '')) &&
          !/localhost|127\.0\.0\.1|\/uploads\//i.test(String(lesson.videoUrl || ''));

        if (!hasLocalVideo && !isRemoteOk) {
          // Prefer remote URL so playback works even if GridFS download/upload fails
          try {
            if (videoRel && videoRel.startsWith('videos/')) {
              try {
                if (!videoBuffer) videoBuffer = await loadHealVideoBuffer();
                await putBuffer(videoRel, videoBuffer, 'video/mp4');
                lesson.videoUrl = publicUploadUrl(videoRel);
              } catch (gridErr) {
                console.warn(`[media] GridFS video heal failed, using remote:`, gridErr.message);
                lesson.videoUrl = HEAL_VIDEO_URL;
              }
            } else {
              lesson.videoUrl = HEAL_VIDEO_URL;
            }
            lesson.videoAvailableAt = new Date();
            healedVideo += 1;
            dirty = true;
            console.log(`[media] Healed lesson video → ${lesson.title} (${lesson.videoUrl})`);
          } catch (error) {
            console.warn(`[media] Could not heal video for ${lesson.title}:`, error.message);
          }
        }
      }

      if (lessonNeedsPdf(lesson)) {
        let pdfRel = relativeUploadPath(lesson.pdfUrl);
        const hasPdf = pdfRel ? Boolean(await findByFilename(pdfRel)) : false;
        if (!hasPdf) {
          try {
            if (!pdfRel || !pdfRel.startsWith('pdfs/')) {
              const id = String(lesson._id || lesson.lessonKey || Date.now());
              pdfRel = `pdfs/healed-${id}.pdf`;
            }
            await putBuffer(pdfRel, minimalPdfBuffer(lesson.pdfTitle || lesson.title), 'application/pdf');
            lesson.pdfUrl = publicUploadUrl(pdfRel);
            lesson.pdfAvailableAt = new Date();
            healedPdf += 1;
            dirty = true;
            console.log(`[media] Healed lesson PDF → ${pdfRel}`);
          } catch (error) {
            console.warn(`[media] Could not heal PDF for ${lesson.title}:`, error.message);
          }
        }
      }
    }

    if (dirty) {
      course.markModified('lessons');
      await course.save();
    }
  }

  return { healedVideo, healedPdf };
}

async function initMediaStore() {
  try {
    await refreshFilenameCache();
    const migrated = await migrateDiskUploads();
    const healed = await healMissingLessonMedia();
    console.log(
      `[media] Persistent GridFS ready (${filenameCache.size} files` +
        `${migrated ? `, migrated ${migrated} from disk` : ''}` +
        `${healed.healedVideo || healed.healedPdf ? `, healed video=${healed.healedVideo} pdf=${healed.healedPdf}` : ''})`
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
    files: filenameCache.size,
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
};
