require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../src/config/db');
const Course = require('../src/models/Course');
const {
  getLessonAppStatus,
  mediaFileExists,
  normalizeMediaAvailabilityOnSave,
} = require('../src/utils/lessonMedia');
const { applyLessonMediaAvailability } = require('../src/utils/mediaAvailability');
const { resolveUploadFilePath, relativeUploadPath, UPLOAD_ROOT } = require('../src/config/uploads');

async function main() {
  const report = [];
  const pass = (msg) => report.push(`PASS  ${msg}`);
  const fail = (msg) => report.push(`FAIL  ${msg}`);
  const info = (msg) => report.push(`INFO  ${msg}`);

  await connectDB();

  if (!fs.existsSync(UPLOAD_ROOT)) {
    fail(`Upload root missing: ${UPLOAD_ROOT}`);
  } else {
    pass(`Upload root exists: ${UPLOAD_ROOT}`);
  }

  const courses = await Course.find({}).lean();
  pass(`Courses in DB: ${courses.length}`);

  let lessonsTotal = 0;
  let withVideoUrl = 0;
  let visibleInApp = 0;
  let missingFiles = 0;

  let withPdfUrl = 0;
  let pdfVisibleInApp = 0;
  let missingPdfFiles = 0;

  for (const course of courses) {
    for (const lesson of course.lessons || []) {
      lessonsTotal += 1;
      const status = getLessonAppStatus(lesson);
      const visible = applyLessonMediaAvailability(lesson);
      if (lesson.videoUrl) {
        withVideoUrl += 1;
        info(`Lesson "${lesson.title}" (${course.level}): videoState=${status.videoState}, file=${status.videoFileOnDisk}, appUrl=${Boolean(visible.videoUrl)}`);
        if (status.videoState === 'missing_file') missingFiles += 1;
        if (status.videoVisibleInApp) visibleInApp += 1;
      }
      if (lesson.pdfUrl) {
        withPdfUrl += 1;
        info(`Lesson "${lesson.title}" (${course.level}): pdfState=${status.pdfState}, file=${status.pdfFileOnDisk}, appPdf=${Boolean(visible.pdfUrl)}`);
        if (status.pdfState === 'missing_file') missingPdfFiles += 1;
        if (status.pdfVisibleInApp) pdfVisibleInApp += 1;
      } else if (lesson.title && !lesson.videoUrl) {
        info(`Lesson "${lesson.title}" (${course.level}): no videoUrl in DB`);
      }
    }
  }

  pass(`Lessons total: ${lessonsTotal}`);
  pass(`Lessons with videoUrl: ${withVideoUrl}`);
  pass(`Lessons visible in app API (video): ${visibleInApp}`);
  pass(`Lessons with pdfUrl: ${withPdfUrl}`);
  pass(`Lessons visible in app API (pdf): ${pdfVisibleInApp}`);
  if (missingFiles) fail(`Lessons with missing video files on disk: ${missingFiles}`);
  else pass('No missing video files for lessons that have videoUrl');
  if (missingPdfFiles) fail(`Lessons with missing PDF files on disk: ${missingPdfFiles}`);
  else pass('No missing PDF files for lessons that have pdfUrl');

  const availability = normalizeMediaAvailabilityOnSave({
    videoUrl: 'https://example.com/uploads/videos/test.mp4',
    pdfUrl: null,
  });
  if (availability.videoAvailableAt instanceof Date) {
    pass('normalizeMediaAvailabilityOnSave sets immediate video availability');
  } else {
    fail('normalizeMediaAvailabilityOnSave did not return a Date');
  }

  const sampleRel = 'videos/__lesson_media_test__.txt';
  const samplePath = resolveUploadFilePath(sampleRel);
  if (samplePath) {
    fs.mkdirSync(path.dirname(samplePath), { recursive: true });
    fs.writeFileSync(samplePath, 'ok');
    const url = `http://localhost:5000/uploads/${sampleRel}`;
    if (mediaFileExists(url)) pass('mediaFileExists resolves local upload URLs');
    else fail('mediaFileExists failed for a file that exists');
    fs.unlinkSync(samplePath);
  }

  const mongoose = require('mongoose');
  await mongoose.disconnect();
  console.log('\n=== Lesson media test ===\n');
  console.log(report.join('\n'));
  console.log('');
  if (report.some((line) => line.startsWith('FAIL'))) process.exit(1);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
