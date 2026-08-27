const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { normalizePrivateKey } = require('../src/services/firebaseService');

const file = path.join(__dirname, '../secrets/firebase-service-account.json');
const account = JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = account.private_key;

const variants = {
  asInJsonFile: raw,
  literalEscapes: raw.replace(/\n/g, '\\n'),
  doubledEscapes: raw.replace(/\n/g, '\\\\n'),
  quotedLiteral: `"${raw.replace(/\n/g, '\\n')}"`,
  oneLineNoEscapes: raw.replace(/\n/g, ''),
  withPrefix: `FIREBASE_PRIVATE_KEY=${raw.replace(/\n/g, '\\n')}`,
  crlfLiteral: raw.replace(/\n/g, '\\r\\n'),
  // Render sometimes turns \n into real backslash + n after copy from JSON with extra escaping
  jsonWrappedKeyOnly: JSON.stringify(raw),
};

let failed = 0;
for (const [name, value] of Object.entries(variants)) {
  const normalized = normalizePrivateKey(value);
  try {
    crypto.createPrivateKey({ key: normalized, format: 'pem' });
    console.log(`OK  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

const cred = {
  ...account,
  private_key: normalizePrivateKey(variants.literalEscapes),
};
admin.initializeApp({ credential: admin.credential.cert(cred) });
console.log('Firebase Admin cert OK with Render-style literal \\n key');
process.exit(failed ? 1 : 0);
