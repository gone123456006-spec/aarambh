require('dotenv').config();

console.log('=== Firebase Environment Variables Check ===\n');

const vars = {
  'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID,
  'FIREBASE_CLIENT_EMAIL': process.env.FIREBASE_CLIENT_EMAIL,
  'FIREBASE_PRIVATE_KEY_ID': process.env.FIREBASE_PRIVATE_KEY_ID,
  'FIREBASE_PRIVATE_KEY': process.env.FIREBASE_PRIVATE_KEY ? `${process.env.FIREBASE_PRIVATE_KEY.substring(0, 50)}...` : undefined,
};

for (const [key, value] of Object.entries(vars)) {
  console.log(`${key}: ${value ? '✅ SET' : '❌ NOT SET'}`);
  if (value && key !== 'FIREBASE_PRIVATE_KEY') {
    console.log(`  Value: ${value}\n`);
  } else if (value) {
    console.log(`  Value: ${value}...\n`);
  } else {
    console.log('');
  }
}

if (vars.FIREBASE_PRIVATE_KEY) {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  console.log('\n=== Private Key Analysis ===');
  console.log(`Length: ${key.length} characters`);
  console.log(`Starts with: ${key.substring(0, 30)}`);
  console.log(`Contains \\n: ${key.includes('\\n') ? 'YES (literal)' : 'NO'}`);
  console.log(`Contains newline: ${key.includes('\n') ? 'YES (actual)' : 'NO'}`);
}
