const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const {
  findByFilename,
  getBucket,
  guessContentType,
} = require('./gridfsMedia');
const { resolveUploadFilePath } = require('./uploads');
const { ensureFaststart } = require('../utils/mp4Faststart');

/** 1 MB read buffer — smoother streaming on mobile players. */
const STREAM_HIGH_WATER_MARK = 1024 * 1024;
/** YouTube-like first segment so playback can start before the whole file arrives. */
const VIDEO_CHUNK_BYTES = 2 * 1024 * 1024;
/** Don't slice requests that are reading the MP4 index at the end of the file. */
const TAIL_WINDOW_BYTES = 8 * 1024 * 1024;

const warmingCache = new Map();
const activeStreams = new Map();

function normalizeRelativePath(relativePath) {
  const raw = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.includes('..')) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function isVideoPath(relativePath) {
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(relativePath || ''));
}

function parseByteRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = String(rangeHeader).match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  let start = match[1] !== '' ? Number(match[1]) : 0;
  let end = match[2] !== '' ? Number(match[2]) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0) start = 0;
  if (end >= size) end = size - 1;
  if (start > end) return null;

  return { start, end };
}

/**
 * Cap huge/open ranges so ExoPlayer/AVPlayer get a small first chunk
 * (like HLS/DASH segments) instead of waiting on a 70MB GridFS download.
 */
function resolvePlaybackRange(rangeHeader, size, video) {
  let range = parseByteRange(rangeHeader, size);

  if (!video) return range;

  if (!range) {
    if (size > VIDEO_CHUNK_BYTES) {
      return { start: 0, end: VIDEO_CHUNK_BYTES - 1 };
    }
    return null;
  }

  const length = range.end - range.start + 1;
  const readingTail = range.start >= Math.max(0, size - TAIL_WINDOW_BYTES);
  if (length > VIDEO_CHUNK_BYTES && !readingTail) {
    return {
      start: range.start,
      end: Math.min(size - 1, range.start + VIDEO_CHUNK_BYTES - 1),
    };
  }
  return range;
}

function setStreamHeaders(res, { contentType, relativePath, file, size }) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Cache-Control',
    isVideoPath(relativePath) ? 'public, max-age=86400' : 'public, max-age=31536000, immutable'
  );

  if (file?.uploadDate) {
    res.setHeader('Last-Modified', new Date(file.uploadDate).toUTCString());
  }
  if (file?._id) {
    res.setHeader('ETag', `W/"${file._id}-${size}"`);
  }

  if (relativePath.endsWith('.pdf')) {
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(relativePath)}"`);
  }
}

function diskCacheIsValid(diskPath, expectedSize) {
  if (!diskPath || !fs.existsSync(diskPath)) return false;
  try {
    const stat = fs.statSync(diskPath);
    return stat.isFile() && stat.size > 0 && stat.size === expectedSize;
  } catch {
    return false;
  }
}

function removeStaleDiskCache(diskPath) {
  try {
    if (diskPath && fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  } catch {
    /* ignore */
  }
}

function trackStream(relativePath, res, onIdle) {
  activeStreams.set(relativePath, (activeStreams.get(relativePath) || 0) + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const next = (activeStreams.get(relativePath) || 1) - 1;
    if (next <= 0) {
      activeStreams.delete(relativePath);
      if (onIdle) setTimeout(onIdle, 1500);
    } else {
      activeStreams.set(relativePath, next);
    }
  };
  res.once('finish', release);
  res.once('close', release);
}

function scheduleDiskWarm(relativePath, file) {
  const diskPath = resolveUploadFilePath(relativePath);
  if (!diskPath || diskCacheIsValid(diskPath, file.length)) return;
  if (warmingCache.has(relativePath)) return;
  if (activeStreams.get(relativePath)) return;

  const gfs = getBucket();
  if (!gfs) return;

  const job = (async () => {
    const dir = path.dirname(diskPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmpPath = `${diskPath}.cache-${process.pid}-${Date.now()}`;
    await pipeline(
      gfs.openDownloadStreamByName(file.filename, { highWaterMark: STREAM_HIGH_WATER_MARK }),
      fs.createWriteStream(tmpPath, { highWaterMark: STREAM_HIGH_WATER_MARK })
    );

    if (/\.mp4$/i.test(relativePath)) {
      try {
        ensureFaststart(tmpPath);
      } catch (error) {
        console.warn(`[media] faststart skipped for ${relativePath}:`, error.message);
      }
    }

    const cachedSize = fs.statSync(tmpPath).size;
    if (cachedSize !== file.length && cachedSize <= 0) {
      removeStaleDiskCache(tmpPath);
      return;
    }

    try {
      fs.renameSync(tmpPath, diskPath);
    } catch {
      removeStaleDiskCache(tmpPath);
    }
  })()
    .catch((error) => {
      console.warn(`[media] Disk warm failed for ${relativePath}:`, error.message);
    })
    .finally(() => {
      warmingCache.delete(relativePath);
    });

  warmingCache.set(relativePath, job);
}

function applyRangeHeaders(res, range, size) {
  if (range) {
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Length', size);
}

async function streamFromDisk(req, res, diskPath, meta) {
  const { size, contentType, relativePath, file } = meta;
  const video = isVideoPath(relativePath);
  const range = resolvePlaybackRange(req.headers.range, size, video);

  setStreamHeaders(res, { contentType, relativePath, file, size });

  if (req.method === 'HEAD') {
    applyRangeHeaders(res, range, size);
    res.end();
    return true;
  }

  applyRangeHeaders(res, range, size);
  const stream = fs.createReadStream(diskPath, {
    start: range ? range.start : 0,
    end: range ? range.end : size - 1,
    highWaterMark: STREAM_HIGH_WATER_MARK,
  });
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
  stream.pipe(res);
  return true;
}

async function streamFromGridFs(req, res, file, relativePath) {
  const gfs = getBucket();
  if (!gfs) return false;

  const size = file.length;
  const contentType = file.contentType || guessContentType(relativePath);
  const video = isVideoPath(relativePath);
  const range = resolvePlaybackRange(req.headers.range, size, video);
  const filename = file.filename || relativePath;

  setStreamHeaders(res, { contentType, relativePath, file, size });

  if (req.method === 'HEAD') {
    applyRangeHeaders(res, range, size);
    res.end();
    return true;
  }

  applyRangeHeaders(res, range, size);

  const stream = gfs.openDownloadStreamByName(filename, {
    start: range ? range.start : 0,
    end: range ? range.end + 1 : undefined,
    highWaterMark: STREAM_HIGH_WATER_MARK,
  });
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = 404;
    res.end();
  });

  trackStream(relativePath, res, () => scheduleDiskWarm(relativePath, file));
  stream.pipe(res);
  return true;
}

/**
 * Stream /uploads/* with disk-first delivery and GridFS fallback.
 * Videos are sent in ~2MB chunks so the player can start immediately.
 */
async function streamUpload(req, res, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) return false;

  const file = await findByFilename(normalized);
  if (!file) return false;

  const diskPath = resolveUploadFilePath(normalized);
  const contentType = file.contentType || guessContentType(normalized);
  const meta = {
    size: file.length,
    contentType,
    relativePath: normalized,
    file,
  };

  if (diskCacheIsValid(diskPath, file.length)) {
    return streamFromDisk(req, res, diskPath, meta);
  }

  return streamFromGridFs(req, res, file, normalized);
}

module.exports = {
  streamUpload,
  STREAM_HIGH_WATER_MARK,
};
