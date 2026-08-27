const {
  mediaFileExists,
  mediaFileExistsAsync,
  canonicalizeMediaUrl,
  relativeUploadPath,
} = require('../config/uploads');

/**
 * Production media visibility for My Courses.
 * - Own /uploads/* URLs must exist on disk or GridFS
 * - External HTTPS URLs (CDN) are allowed as-is
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

  if (out.videoAvailableAt && out.videoUrl) {
    const at = new Date(out.videoAvailableAt).getTime();
    const waitMs = at - now;
    if (waitMs > 0 && waitMs <= 60 * 60 * 1000) {
      out.videoAvailableIn = Math.ceil(waitMs / 1000);
      out.videoUrl = null;
    }
  }

  if (out.videoUrl) {
    const rel = relativeUploadPath(out.videoUrl);
    const ok = await mediaFileExistsAsync(out.videoUrl);
    if (!ok) {
      out.videoMissingOnServer = true;
      // Hide broken self-hosted uploads so the app shows a clear re-upload state
      if (rel) {
        out.videoUrl = null;
      }
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
    const rel = relativeUploadPath(out.pdfUrl);
    const ok = await mediaFileExistsAsync(out.pdfUrl);
    if (!ok) {
      out.pdfMissingOnServer = true;
      if (rel) {
        out.pdfUrl = null;
      }
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
