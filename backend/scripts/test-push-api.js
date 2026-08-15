require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testPushNotificationAPI() {
  console.log('=== Testing Push Notification API ===\n');

  try {
    // 1. Test health endpoint
    console.log('1. Testing server health...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅ Server is running:', health.data);

    // 2. Login as admin
    console.log('\n2. Logging in as admin...');
    const loginRes = await axios.post(`${BASE_URL}/api/admin/login`, {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD
    });
    const token = loginRes.data.accessToken;
    console.log('   ✅ Admin login successful');

    // 3. Get push notification stats
    console.log('\n3. Getting push notification stats...');
    const statsRes = await axios.get(`${BASE_URL}/api/admin/push-notifications/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('   ✅ Stats retrieved:');
    console.log('      Firebase Enabled:', statsRes.data.data.firebaseEnabled);
    console.log('      Total Users:', statsRes.data.data.totalUsers);
    console.log('      Active Devices:', statsRes.data.data.activeDevices);
    console.log('      Users with Notifications:', statsRes.data.data.usersWithNotifications);
    console.log('      Total Notifications Sent:', statsRes.data.data.totalNotificationsSent);

    // 4. Get notification history
    console.log('\n4. Getting notification history...');
    const historyRes = await axios.get(`${BASE_URL}/api/admin/push-notifications/history?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('   ✅ History retrieved:');
    console.log('      Total Notifications:', historyRes.data.data.total);
    console.log('      Recent Notifications:', historyRes.data.data.notifications.length);

    // 5. Get daily notification config
    console.log('\n5. Getting daily notification config...');
    const dailyRes = await axios.get(`${BASE_URL}/api/admin/push-notifications/daily-config`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('   ✅ Daily config retrieved:');
    console.log('      Schedule:', dailyRes.data.data.schedule);
    console.log('      Message Pool Size:', dailyRes.data.data.totalMessages);

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL PUSH NOTIFICATION API ENDPOINTS ARE WORKING!');
    console.log('='.repeat(60));
    
    if (statsRes.data.data.firebaseEnabled) {
      console.log('\n🎉 Firebase is ENABLED and READY to send notifications!');
      console.log('\n📱 To send a notification:');
      console.log('   1. Go to http://localhost:5000/admin');
      console.log('   2. Navigate to "Notifications" tab');
      console.log('   3. Click "Send Push Notification"');
      console.log('   4. Fill in the form and send!');
    } else {
      console.log('\n⚠️  Firebase is NOT enabled. Check server logs.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testPushNotificationAPI();
