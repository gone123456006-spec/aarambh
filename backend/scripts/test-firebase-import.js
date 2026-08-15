console.log('=== Testing Firebase Admin Import ===\n');

try {
  const admin = require('firebase-admin');
  
  console.log('1. Module loaded successfully');
  console.log('2. Type of admin:', typeof admin);
  console.log('3. admin keys:', Object.keys(admin));
  console.log('4. admin.credential:', admin.credential);
  console.log('5. Type of admin.credential:', typeof admin.credential);
  
  if (admin.credential) {
    console.log('6. admin.credential keys:', Object.keys(admin.credential));
    console.log('7. admin.credential.cert:', typeof admin.credential.cert);
  } else {
    console.log('6. ❌ admin.credential is undefined!');
  }
  
  // Try initializing
  if (admin.credential && admin.credential.cert) {
    console.log('\n8. ✅ Can call admin.credential.cert - Firebase should work!');
  } else {
    console.log('\n8. ❌ Cannot call admin.credential.cert - Firebase will NOT work!');
  }
  
} catch (error) {
  console.error('ERROR:', error.message);
  console.error('Stack:', error.stack);
}
