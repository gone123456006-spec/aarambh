const fs = require('fs');

const CONTAINER_TYPES = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'edts',
  'moof',
  'traf',
]);

function readSize(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  let size = buffer.readUInt32BE(offset);
  const type = buffer.toString('ascii', offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buffer.length) return null;
    const hi = buffer.readUInt32BE(offset + 8);
    const lo = buffer.readUInt32BE(offset + 12);
    size = hi * 0x100000000 + lo;
    headerSize = 16;
  } else if (size === 0) {
    size = buffer.length - offset;
  }
  if (size < headerSize || offset + size > buffer.length) return null;
  return { size, type, headerSize };
}

function collectTopBoxes(buffer) {
  const boxes = [];
  let offset = 0;
  while (offset < buffer.length) {
    const header = readSize(buffer, offset);
    if (!header) break;
    boxes.push({
      type: header.type,
      start: offset,
      size: header.size,
      buf: buffer.subarray(offset, offset + header.size),
    });
    offset += header.size;
  }
  return boxes;
}

function patchChunkOffsets(moov, delta) {
  const buf = Buffer.from(moov);
  let offset = 8;
  if (moov.readUInt32BE(0) === 1) offset = 16;

  const visit = (start, end) => {
    let cursor = start;
    while (cursor + 8 <= end) {
      const header = readSize(buf, cursor);
      if (!header) break;
      const payload = cursor + header.headerSize;
      if (header.type === 'stco' && payload + 8 <= cursor + header.size) {
        const count = buf.readUInt32BE(payload + 4);
        let entry = payload + 8;
        for (let i = 0; i < count && entry + 4 <= cursor + header.size; i += 1, entry += 4) {
          buf.writeUInt32BE((buf.readUInt32BE(entry) + delta) >>> 0, entry);
        }
      } else if (header.type === 'co64' && payload + 8 <= cursor + header.size) {
        const count = buf.readUInt32BE(payload + 4);
        let entry = payload + 8;
        for (let i = 0; i < count && entry + 8 <= cursor + header.size; i += 1, entry += 8) {
          const hi = buf.readUInt32BE(entry);
          const lo = buf.readUInt32BE(entry + 4);
          let value = hi * 0x100000000 + lo + delta;
          buf.writeUInt32BE(Math.floor(value / 0x100000000), entry);
          buf.writeUInt32BE(value >>> 0, entry + 4);
        }
      } else if (CONTAINER_TYPES.has(header.type)) {
        visit(payload, cursor + header.size);
      }
      cursor += header.size;
    }
  };

  visit(offset, buf.length);
  return buf;
}

/**
 * Move `moov` before `mdat` so mobile players can start without downloading
 * the whole file (YouTube-style progressive MP4).
 */
function remuxFaststart(buffer) {
  if (!buffer || buffer.length < 16) return null;
  const boxes = collectTopBoxes(buffer);
  if (!boxes.length) return null;
  if (boxes.some((b) => b.type === 'moof')) return null;

  const moovIndex = boxes.findIndex((b) => b.type === 'moov');
  const mdatIndex = boxes.findIndex((b) => b.type === 'mdat');
  if (moovIndex < 0 || mdatIndex < 0 || moovIndex < mdatIndex) return null;

  const ftyp = boxes.find((b) => b.type === 'ftyp');
  const moov = boxes[moovIndex];
  const mdat = boxes[mdatIndex];

  const newOrder = [];
  if (ftyp) newOrder.push(ftyp);
  newOrder.push(moov);
  for (const box of boxes) {
    if (box.type !== 'ftyp' && box.type !== 'moov') newOrder.push(box);
  }

  let newMdatStart = 0;
  for (const box of newOrder) {
    if (box.type === 'mdat') break;
    newMdatStart += box.size;
  }
  const delta = newMdatStart - mdat.start;
  if (!delta) return null;

  const patchedMoov = patchChunkOffsets(moov.buf, delta);
  const parts = newOrder.map((box) => (box.type === 'moov' ? patchedMoov : box.buf));
  return Buffer.concat(parts, buffer.length);
}

function ensureFaststart(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  if (!/\.mp4$/i.test(filePath)) return false;

  const original = fs.readFileSync(filePath);
  const remuxed = remuxFaststart(original);
  if (!remuxed) return false;

  const tmp = `${filePath}.faststart`;
  fs.writeFileSync(tmp, remuxed);
  fs.renameSync(tmp, filePath);
  return true;
}

module.exports = {
  remuxFaststart,
  ensureFaststart,
};
