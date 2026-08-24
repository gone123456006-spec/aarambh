const ApiError = require('../utils/ApiError');
const { buildUploadPayload, deleteFileByUrl, deleteFileByRelativePath } = require('../config/uploads');
const { putFileFromDisk } = require('../config/gridfsMedia');

async function persistToGridFs(subpath, req) {
  const absPath = req.file?.path;
  if (!absPath) {
    throw new ApiError(500, 'Uploaded file was not saved');
  }
  await putFileFromDisk(subpath, absPath, req.file.mimetype);
}

/**
 * Persist videos, PDFs, and images to MongoDB GridFS so they survive Render deploys.
 */
function saveAvatar(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please provide an image file');
  }

  const subpath = `avatars/${req.file.filename}`;
  return persistToGridFs(subpath, req).then(() => buildUploadPayload(req, subpath));
}

function saveLessonVideo(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a video file');
  }

  const subpath = `videos/${req.file.filename}`;
  return persistToGridFs(subpath, req).then(() => buildUploadPayload(req, subpath));
}

function saveLessonPdf(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a PDF file');
  }

  const subpath = `pdfs/${req.file.filename}`;
  return persistToGridFs(subpath, req).then(() => buildUploadPayload(req, subpath));
}

function saveHeroImage(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please choose an image to upload');
  }

  const subpath = `hero/${req.file.filename}`;
  return persistToGridFs(subpath, req).then(() => buildUploadPayload(req, subpath));
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
