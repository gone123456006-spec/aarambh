const ApiError = require('../utils/ApiError');
const { buildUploadPayload, deleteFileByUrl, deleteFileByRelativePath } = require('../config/uploads');
const { putFileFromDisk, assertGridFsReady } = require('../config/gridfsMedia');
const { ensureFaststart } = require('../utils/mp4Faststart');

async function persistToGridFs(subpath, req) {
  assertGridFsReady();
  const absPath = req.file?.path;
  if (!absPath) {
    throw new ApiError(500, 'Uploaded file was not saved to disk');
  }
  const stored = await putFileFromDisk(subpath, absPath, req.file.mimetype);
  return stored;
}

/**
 * Production media: multer temp disk → MongoDB GridFS (permanent) → public URL.
 */
async function saveAvatar(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please provide an image file');
  }

  const subpath = `avatars/${req.file.filename}`;
  const stored = await persistToGridFs(subpath, req);
  return {
    ...buildUploadPayload(req, subpath),
    storage: 'gridfs',
    verified: true,
    bytes: stored.length,
  };
}

async function saveLessonVideo(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a video file');
  }

  try {
    ensureFaststart(req.file.path);
  } catch (error) {
    console.warn('[media] faststart remux skipped:', error.message);
  }

  const subpath = `videos/${req.file.filename}`;
  const stored = await persistToGridFs(subpath, req);
  return {
    ...buildUploadPayload(req, subpath),
    storage: 'gridfs',
    verified: true,
    bytes: stored.length,
    contentType: stored.contentType || req.file.mimetype,
  };
}

async function saveLessonPdf(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a PDF file');
  }

  const subpath = `pdfs/${req.file.filename}`;
  const stored = await persistToGridFs(subpath, req);
  return {
    ...buildUploadPayload(req, subpath),
    storage: 'gridfs',
    verified: true,
    bytes: stored.length,
    contentType: stored.contentType || 'application/pdf',
  };
}

async function saveHeroImage(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please choose an image to upload');
  }

  const subpath = `hero/${req.file.filename}`;
  const stored = await persistToGridFs(subpath, req);
  return {
    ...buildUploadPayload(req, subpath),
    storage: 'gridfs',
    verified: true,
    bytes: stored.length,
  };
}

function deleteLocalAsset(fileUrl) {
  try {
    deleteFileByUrl(fileUrl);
  } catch (error) {
    console.error('Failed to delete media file:', error.message);
  }
}

function deleteLocalPath(relativePath) {
  try {
    deleteFileByRelativePath(relativePath);
    const { deleteByFilename } = require('../config/gridfsMedia');
    deleteByFilename(relativePath).catch((error) => {
      console.warn('[media] GridFS delete failed:', error.message);
    });
  } catch (error) {
    console.error('Failed to delete media file:', error.message);
  }
}

module.exports = {
  saveAvatar,
  saveLessonVideo,
  saveLessonPdf,
  saveHeroImage,
  deleteLocalAsset,
  deleteLocalPath,
};
