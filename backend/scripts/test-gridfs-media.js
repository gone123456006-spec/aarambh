require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { putFileFromDisk, deleteByFilename, initMediaStore, tryStreamGridFs } = require('../src/config/gridfsMedia');
const { mediaFileExists, UPLOAD_DIRS, ensureUploadDirs } = require('../src/config/uploads');

async function main() {
  ensureUploadDirs();
  await connectDB();
  await initMediaStore();

  const relVideo = `videos/__persist_test_${Date.now()}.mp4`;
  const relPdf = `pdfs/__persist_test_${Date.now()}.pdf`;
  const videoPath = path.join(UPLOAD_DIRS.videos, path.basename(relVideo));
  const pdfPath = path.join(UPLOAD_DIRS.pdfs, path.basename(relPdf));

  fs.writeFileSync(videoPath, Buffer.from('fake-mp4-bytes-for-gridfs-test'));
  fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 test'));

  await putFileFromDisk(relVideo, videoPath, 'video/mp4');
  await putFileFromDisk(relPdf, pdfPath, 'application/pdf');

  const videoUrl = `https://aarambh-api.onrender.com/uploads/${relVideo}`;
  const pdfUrl = `https://aarambh-api.onrender.com/uploads/${relPdf}`;

  if (!mediaFileExists(videoUrl)) throw new Error('video should exist in GridFS cache');
  if (!mediaFileExists(pdfUrl)) throw new Error('pdf should exist in GridFS cache');

  fs.unlinkSync(videoPath);
  fs.unlinkSync(pdfPath);

  if (!mediaFileExists(videoUrl)) throw new Error('video should still exist after disk delete');
  if (!mediaFileExists(pdfUrl)) throw new Error('pdf should still exist after disk delete');

  const server = http.createServer(async (req, res) => {
    const ok = await tryStreamGridFs(req, res, relPdf);
    if (!ok) res.statusCode = 404, res.end('missing');
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const body = await new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: '/' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });

  if (!body.toString().includes('%PDF')) throw new Error('GridFS stream did not return PDF bytes');
  server.close();

  await deleteByFilename(relVideo);
  await deleteByFilename(relPdf);
  await mongoose.disconnect();
  console.log('PASS  GridFS video/PDF persist + stream after disk delete');
}

main().catch(async (error) => {
  console.error('FAIL ', error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
