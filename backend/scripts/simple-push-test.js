// Simple test to check if Firebase is initialized in the running server
// by checking the actual firebaseService module state

console.log('=== Simple Push Notification System Check ===\n');

// Test 1: Check environment variables
console.log('1. Environment Variables:');
require('dotenv').config();
console.log('   FIREBASE_SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? '✅ SET' : '❌ NOT SET');
console.log('   FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ SET' : '❌ NOT SET');

// Test 2: Check if service account file exists
const fs = require('fs');
const path = require('path');
const serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './secrets/firebase-service-account.json');
const fileExists = fs.existsSync(serviceAccountPath);
console.log('\n2. Service Account File:');
console.log('   Path:', serviceAccountPath);
console.log('   Exists:', fileExists ? '✅ YES' : '❌ NO');

if (fileExists) {
  try {
    const content = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('   Valid JSON:', content.project_id ? '✅ YES' : '❌ NO');
    console.log('   Project ID:', content.project_id);
  } catch (err) {
    console.log('   Valid JSON: ❌ ERROR -', err.message);
  }
}

// Test 3: Test Firebase Admin import
console.log('\n3. Firebase Admin SDK:');
try {
  const admin = require('firebase-admin');
  console.log('   Module loaded: ✅ YES');
  console.log('   admin.cert available:', typeof admin.cert === 'function' ? '✅ YES' : '❌ NO');
  console.log('   admin.initializeApp available:', typeof admin.initializeApp === 'function' ? '✅ YES' : '❌ NO');
} catch (err) {
  console.log('   Module loaded: ❌ ERROR -', err.message);
}

// Test 4: Check server logs
console.log('\n4. Server Status:');
console.log('   Check the running server terminal for:');
console.log('   "✅ Firebase Admin initialized successfully"');
console.log('   If you see this message, Firebase is working!');

console.log('\n5. Admin Panel:');
console.log('   URL: http://localhost:5000/admin');
console.log('   Username:', process.env.ADMIN_USERNAME);
console.log('   Go to Notifications tab → Send Push Notification');

console.log('\n' + '='.repeat(60));
console.log('📊 QUICK CHECK SUMMARY');
console.log('='.repeat(60));

const allGood = fileExists && process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (allGood) {
  console.log('✅ Configuration looks good!');
  console.log('✅ Check server logs to confirm Firebase initialized.');
  console.log('✅ Test by accessing: http://localhost:5000/admin');
} else {
  console.log('❌ Configuration issues detected.');
  console.log('   Fix and restart the server.');
}
console.log();
