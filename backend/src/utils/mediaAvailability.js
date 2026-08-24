const { mediaFileExists, mediaFileExistsAsync, canonicalizeMediaUrl } = require('../config/uploads');

async function applyLessonMediaAvailability(lesson) {
  const out = lesson.toObject ? lesson.toObject() : { ...lesson };
  const now = Date.now();

  if (out.videoUrl) {
    out.videoUrl = canonicalizeMediaUrl(out.videoUrl);
  }
  if (out.pdfUrl) {
    out.pdfUrl = canonicalizeMediaUrl(out.pdfUrl);
  }

  if (out.videoAvailableAt) {
    const at = new Date(out.videoAvailableAt).getTime();
    if (at > now) {
      out.videoAvailableIn = Math.ceil((at - now) / 1000);
      out.videoUrl = null;
    }
  }

  if (out.videoUrl) {
    const ok = await mediaFileExistsAsync(out.videoUrl);
    if (!ok) {
      out.videoUrl = null;
      out.videoMissingOnServer = true;
    }
  }

  if (out.pdfAvailableAt) {
    const at = new Date(out.pdfAvailableAt).getTime();
    if (at > now) {
      out.pdfAvailableIn = Math.ceil((at - now) / 1000);
      out.pdfUrl = null;
    }
  }

  if (out.pdfUrl) {
    const ok = await mediaFileExistsAsync(out.pdfUrl);
    if (!ok) {
      out.pdfUrl = null;
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
