const crypto = require('crypto');
const { normalizePrivateKey } = require('../src/services/firebaseService');

function makeSamplePem() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return privateKey;
}

function assertValid(label, raw) {
  const normalized = normalizePrivateKey(raw);
  try {
    crypto.createPrivateKey({ key: normalized, format: 'pem' });
    console.log(`✅ ${label}`);
    return true;
  } catch (error) {
    console.error(`❌ ${label}:`, error.message);
    return false;
  }
}

const pem = makeSamplePem();
const oneLine = pem.replace(/\n/g, '');
const literalEscapes = pem.replace(/\n/g, '\\n');
const prefixed = `FIREBASE_PRIVATE_KEY=${literalEscapes}`;
const quoted = `"${literalEscapes}"`;
const base64Wrapped = Buffer.from(pem, 'utf8').toString('base64');

const results = [
  assertValid('multiline pem', pem),
  assertValid('one line pem', oneLine),
  assertValid('literal \\n escapes', literalEscapes),
  assertValid('env prefix + literal \\n', prefixed),
  assertValid('quoted literal \\n', quoted),
  assertValid('base64 wrapped pem', base64Wrapped),
];

if (!results.every(Boolean)) {
  process.exit(1);
}

console.log('\nAll normalizePrivateKey format tests passed.');
