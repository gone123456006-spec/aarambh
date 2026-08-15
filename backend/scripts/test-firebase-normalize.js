require('dotenv').config();

function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  // Remove surrounding quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Replace literal \n with actual newlines (handles both \\n and \n)
  // First try double-escaped (from JSON string)
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  return key;
}

console.log('=== Testing normalizePrivateKey ===\n');

const raw = process.env.FIREBASE_PRIVATE_KEY;
console.log('Raw key (first 80 chars):', raw?.substring(0, 80));
console.log('Raw length:', raw?.length);
console.log('Contains \\n (literal):', raw?.includes('\\n'));

const normalized = normalizePrivateKey(raw);
console.log('\nNormalized key (first 80 chars):', normalized?.substring(0, 80));
console.log('Normalized length:', normalized?.length);
console.log('Contains actual newline:', normalized?.includes('\n'));

console.log('\n=== Testing Firebase Credential ===');
const admin = require('firebase-admin');

try {
  const credentials = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID?.trim(),
    client_email: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
    private_key: normalized,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID?.trim(),
  };

  console.log('Credentials object created successfully');
  console.log('Project ID:', credentials.project_id);
  console.log('Client Email:', credentials.client_email);
  console.log('Private Key ID:', credentials.private_key_id);
  console.log('Private Key (first 50 chars):', credentials.private_key.substring(0, 50));
  console.log('Private Key (last 50 chars):', credentials.private_key.substring(credentials.private_key.length - 50));
  
  console.log('\nTrying admin.credential.cert()...');
  const cert = admin.credential.cert(credentials);
  console.log('✅ cert() succeeded:', typeof cert);
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}
