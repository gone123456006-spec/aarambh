const { mediaFileExists, mediaFileExistsAsync } = require('../config/uploads');
const { applyLessonMediaAvailability } = require('./mediaAvailability');

async function getLessonAppStatus(lesson) {
  const plain = lesson?.toObject ? lesson.toObject() : { ...(lesson || {}) };
  const visible = await applyLessonMediaAvailability(plain);
  const hasVideoUrl = Boolean(plain.videoUrl);
  const hasPdfUrl = Boolean(plain.pdfUrl);
  const videoFileOnDisk = hasVideoUrl ? await mediaFileExistsAsync(plain.videoUrl) : false;
  const pdfFileOnDisk = hasPdfUrl ? await mediaFileExistsAsync(plain.pdfUrl) : false;
  const videoVisibleInApp = Boolean(visible.videoUrl);
  const pdfVisibleInApp = Boolean(visible.pdfUrl);
  const videoPendingSeconds = visible.videoAvailableIn || 0;
  const pdfPendingSeconds = visible.pdfAvailableIn || 0;

  let videoState = 'none';
  if (hasVideoUrl) {
    if (!videoFileOnDisk) videoState = 'missing_file';
    else if (videoPendingSeconds > 0) videoState = 'pending';
    else if (videoVisibleInApp) videoState = 'live';
    else videoState = 'hidden';
  }

  let pdfState = 'none';
  if (hasPdfUrl) {
    if (!pdfFileOnDisk) pdfState = 'missing_file';
    else if (pdfPendingSeconds > 0) pdfState = 'pending';
    else if (pdfVisibleInApp) pdfState = 'live';
    else pdfState = 'hidden';
  }

  return {
    hasVideoUrl,
    hasPdfUrl,
    videoFileOnDisk,
    pdfFileOnDisk,
    videoVisibleInApp,
    pdfVisibleInApp,
    videoPendingSeconds,
    pdfPendingSeconds,
    videoState,
    pdfState,
    appReady: videoVisibleInApp || pdfVisibleInApp,
  };
}

function normalizeMediaAvailabilityOnSave({ videoUrl, pdfUrl, videoAvailableAt, pdfAvailableAt }) {
  const now = new Date();
  let nextVideoAt = videoAvailableAt;
  let nextPdfAt = pdfAvailableAt;

  if (videoUrl) {
    nextVideoAt = now;
  }
  if (pdfUrl) {
    nextPdfAt = now;
  }

  return {
    videoAvailableAt: nextVideoAt,
    pdfAvailableAt: nextPdfAt,
  };
}

async function assertMediaFilesExist({ videoUrl, pdfUrl }) {
  const { mediaFileExistsAsync } = require('../config/uploads');
  if (videoUrl && !(await mediaFileExistsAsync(videoUrl))) {
    throw new Error('Video file was not saved on the server. Please upload the video again.');
  }
  if (pdfUrl && !(await mediaFileExistsAsync(pdfUrl))) {
    throw new Error('PDF file was not saved on the server. Please upload the PDF again.');
  }
}

module.exports = {
  mediaFileExists,
  getLessonAppStatus,
  normalizeMediaAvailabilityOnSave,
  assertMediaFilesExist,
};
