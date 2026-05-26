const ApiError = require('../utils/ApiError');
const { buildUploadPayload, deleteFileByUrl } = require('../config/uploads');

/**
 * Local disk uploads (videos, PDFs, avatars). No Cloudinary.
 */
function saveAvatar(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please provide an image file');
  }

  const subpath = `avatars/${req.file.filename}`;
  return buildUploadPayload(req, subpath);
}

function saveLessonVideo(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a video file');
  }

  const subpath = `videos/${req.file.filename}`;
  return buildUploadPayload(req, subpath);
}

function saveLessonPdf(req) {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a PDF file');
  }

  const subpath = `pdfs/${req.file.filename}`;
  return buildUploadPayload(req, subpath);
}

function deleteLocalAsset(fileUrl) {
  try {
    deleteFileByUrl(fileUrl);
  } catch (error) {
    console.error('Failed to delete local file:', error.message);
  }
}

module.exports = {
  saveAvatar,
  saveLessonVideo,
  saveLessonPdf,
  deleteLocalAsset,
};
