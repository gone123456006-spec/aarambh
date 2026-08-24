const { mediaFileExists, mediaFileExistsAsync, canonicalizeMediaUrl } = require('../config/uploads');

/**
 * Prepare lesson media for the app.
 * Do NOT strip videoUrl/pdfUrl when the file check fails — that caused false
 * "Video unavailable" errors even when GridFS had (or remote URLs pointed to) media.
 */
async function applyLessonMediaAvailability(lesson) {
  const out = lesson.toObject ? lesson.toObject() : { ...lesson };
  const now = Date.now();

  if (out.videoUrl) {
    out.videoUrl = canonicalizeMediaUrl(out.videoUrl);
  }
  if (out.pdfUrl) {
    out.pdfUrl = canonicalizeMediaUrl(out.pdfUrl);
  }

  // Only hide while a real future processing window is active (ignore stale/bad dates > 1h)
  if (out.videoAvailableAt && out.videoUrl) {
    const at = new Date(out.videoAvailableAt).getTime();
    const waitMs = at - now;
    if (waitMs > 0 && waitMs <= 60 * 60 * 1000) {
      out.videoAvailableIn = Math.ceil(waitMs / 1000);
      out.videoUrl = null;
    }
  }

  if (out.videoUrl) {
    const ok = await mediaFileExistsAsync(out.videoUrl);
    if (!ok) {
      out.videoMissingOnServer = true;
      // Keep URL — client /uploads + GridFS or remote host may still serve it
    }
  }

  if (out.pdfAvailableAt && out.pdfUrl) {
    const at = new Date(out.pdfAvailableAt).getTime();
    const waitMs = at - now;
    if (waitMs > 0 && waitMs <= 60 * 60 * 1000) {
      out.pdfAvailableIn = Math.ceil(waitMs / 1000);
      out.pdfUrl = null;
    }
  }

  if (out.pdfUrl) {
    const ok = await mediaFileExistsAsync(out.pdfUrl);
    if (!ok) {
      out.pdfMissingOnServer = true;
    }
  }

  return out;
}

async function applyCourseMediaAvailability(course) {
  const out = course.toObject ? course.toObject() : { ...course };
  if (Array.isArray(out.lessons)) {
    out.lessons = await Promise.all(out.lessons.map(applyLessonMediaAvailability));
  }
  return out;
}

module.exports = {
  applyLessonMediaAvailability,
  applyCourseMediaAvailability,
  mediaFileExists,
};
