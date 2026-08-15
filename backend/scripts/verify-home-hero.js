/**
 * Live Home hero API checks (upload, public read, replace, delete).
 * Run from backend/: node scripts/verify-home-hero.js
 */
require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function main() {
  const health = await fetch(`${BASE}/health`);
  assert.ok(health.ok, 'Backend is not running');

  const publicEmpty = await json(await fetch(`${BASE}/api/app/home-hero`));
  assert.strictEqual(publicEmpty.success, true, 'Public hero GET must succeed');
  assert.ok('imageUrl' in (publicEmpty.data || {}), 'Public hero must return imageUrl');

  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  const login = await json(loginRes);
  assert.ok(loginRes.ok, login.message || 'Admin login failed');
  const token = login.data.accessToken;
  assert.ok(token, 'Admin token missing');

  const tmp = path.join(os.tmpdir(), `ohms-hero-${Date.now()}.png`);
  fs.writeFileSync(tmp, PNG);

  const form = new FormData();
  form.append('image', new Blob([PNG], { type: 'image/png' }), 'hero.png');
  const uploadRes = await fetch(`${BASE}/api/admin/home-hero`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploaded = await json(uploadRes);
  assert.ok(uploadRes.ok, uploaded.message || 'Hero upload failed');
  assert.ok(uploaded.data.imageUrl, 'Upload must return imageUrl');
  assert.ok(/\/uploads\/hero\//.test(uploaded.data.imageUrl), 'Hero URL must point at /uploads/hero/');
  assert.ok(uploaded.data.updatedAt, 'Upload must return updatedAt');

  const imgRes = await fetch(uploaded.data.imageUrl);
  assert.ok(imgRes.ok, `Hero file not reachable at ${uploaded.data.imageUrl}`);
  assert.ok((imgRes.headers.get('content-type') || '').startsWith('image/'), 'Hero file must be served as an image');

  const publicLive = await json(await fetch(`${BASE}/api/app/home-hero`));
  assert.ok(publicLive.data.imageUrl, 'Public GET must show the saved hero');
  assert.ok(publicLive.data.imageUrl.includes('/uploads/hero/'), 'Public URL must be a hero upload');

  const adminGet = await json(
    await fetch(`${BASE}/api/admin/home-hero`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  assert.ok(adminGet.data.imageUrl, 'Admin GET must show the live hero');

  const badForm = new FormData();
  badForm.append('image', new Blob(['not-an-image'], { type: 'text/plain' }), 'note.txt');
  const badRes = await fetch(`${BASE}/api/admin/home-hero`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: badForm,
  });
  assert.ok(!badRes.ok, 'Non-image upload must be rejected');

  const form2 = new FormData();
  form2.append('image', new Blob([PNG], { type: 'image/png' }), 'hero-2.png');
  const replaceRes = await fetch(`${BASE}/api/admin/home-hero`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form2,
  });
  const replaced = await json(replaceRes);
  assert.ok(replaceRes.ok, replaced.message || 'Replace upload failed');
  assert.ok(replaced.data.imageUrl);
  assert.notStrictEqual(replaced.data.imageUrl.split('?')[0], uploaded.data.imageUrl.split('?')[0], 'Replace must store a new file');

  const delRes = await fetch(`${BASE}/api/admin/home-hero`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const deleted = await json(delRes);
  assert.ok(delRes.ok, deleted.message || 'Delete failed');
  assert.strictEqual(deleted.data.imageUrl, null);

  const publicAfter = await json(await fetch(`${BASE}/api/app/home-hero`));
  assert.strictEqual(publicAfter.data.imageUrl, null, 'Public GET must be empty after delete');

  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }

  console.log('Home hero checks passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
