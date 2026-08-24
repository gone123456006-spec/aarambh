/**
 * Read a Firebase service account JSON file and print Render-ready env vars.
 *
 * Usage:
 *   node scripts/prepare-firebase-render-env.js path/to/serviceAccountKey.json
 *
 * Paste the printed values into Render Dashboard -> Environment.
 * Prefer FIREBASE_SERVICE_ACCOUNT_JSON (single line) — most reliable on Render.
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/prepare-firebase-render-env.js <serviceAccountKey.json>');
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

const account = JSON.parse(fs.readFileSync(resolved, 'utf8'));
const required = ['project_id', 'client_email', 'private_key', 'private_key_id'];
const missing = required.filter((key) => !account[key]);
if (missing.length) {
  console.error(`Missing fields in JSON: ${missing.join(', ')}`);
  process.exit(1);
}

const jsonOneLine = JSON.stringify(account);

console.log('=== Option A (recommended): one env var ===\n');
console.log('Key: FIREBASE_SERVICE_ACCOUNT_JSON');
console.log('Value: paste this entire line (no line breaks):\n');
console.log(jsonOneLine);
console.log('\n=== Option B: split env vars ===\n');
console.log(`FIREBASE_PROJECT_ID=${account.project_id}`);
console.log(`FIREBASE_CLIENT_EMAIL=${account.client_email}`);
console.log(`FIREBASE_PRIVATE_KEY_ID=${account.private_key_id}`);
console.log('FIREBASE_PRIVATE_KEY=');
console.log(
  account.private_key.replace(/\n/g, '\\n')
);
console.log('\n=== Render notes ===');
console.log('- Do not set FIREBASE_SERVICE_ACCOUNT_PATH on Render.');
console.log('- Use Option A OR Option B, not both.');
console.log('- For Option B, paste the private key as one line with literal \\n characters.');
console.log('- Redeploy after saving env vars. Logs should show: Firebase Admin initialized successfully.');
