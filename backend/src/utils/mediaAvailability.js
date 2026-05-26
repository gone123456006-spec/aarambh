/**
 * Hide video/PDF URLs until availableAt (30s after upload).
 */
function applyLessonMediaAvailability(lesson) {
  const out = lesson.toObject ? lesson.toObject() : { ...lesson };
  const now = Date.now();

  if (out.videoAvailableAt) {
    const at = new Date(out.videoAvailableAt).getTime();
    if (at > now) {
      out.videoAvailableIn = Math.ceil((at - now) / 1000);
      out.videoUrl = null;
    }
  }

  if (out.pdfAvailableAt) {
    const at = new Date(out.pdfAvailableAt).getTime();
    if (at > now) {
      out.pdfAvailableIn = Math.ceil((at - now) / 1000);
      out.pdfUrl = null;
    }
  }

  return out;
}

function applyCourseMediaAvailability(course) {
  const out = course.toObject ? course.toObject() : { ...course };
  if (Array.isArray(out.lessons)) {
    out.lessons = out.lessons.map(applyLessonMediaAvailability);
  }
  return out;
}

module.exports = {
  applyLessonMediaAvailability,
  applyCourseMediaAvailability,
};
