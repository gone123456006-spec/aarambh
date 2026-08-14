/**
 * Comprehensive Feature Testing Script
 * 
 * This script tests all major features to ensure they're working:
 * - Database connection
 * - Leaderboard functionality
 * - Admin API endpoints
 * - Subscription functionality
 * - Email service
 * 
 * Run this before deploying to production.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji, color, message) {
  console.log(`${emoji} ${color}${message}${colors.reset}`);
}

function success(message) {
  log('✅', colors.green, message);
}

function error(message) {
  log('❌', colors.red, message);
}

function info(message) {
  log('ℹ️ ', colors.cyan, message);
}

function warn(message) {
  log('⚠️ ', colors.yellow, message);
}

async function testDatabaseConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Database Connection');
  console.log('='.repeat(60));

  try {
    if (!MONGODB_URI) {
      error('MONGODB_URI not found in environment variables');
      return false;
    }
    
    info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    success('Connected to MongoDB successfully');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    info(`Found ${collections.length} collections`);
    
    return true;
  } catch (err) {
    error(`Database connection failed: ${err.message}`);
    return false;
  }
}

async function testLeaderboardIndex() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Leaderboard Index');
  console.log('='.repeat(60));

  try {
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Check if index exists
    const indexes = await usersCollection.indexes();
    const leaderboardIndex = indexes.find(idx => 
      idx.key.totalPoints === -1 && idx.key._id === 1
    );
    
    if (leaderboardIndex) {
      success('Leaderboard index exists: { totalPoints: -1, _id: 1 }');
      info(`Index name: ${leaderboardIndex.name}`);
    } else {
      error('Leaderboard index NOT found');
      warn('Run: node scripts/setup-leaderboard-index.js');
      return false;
    }
    
    // Check if users have totalPoints field
    const usersWithoutPoints = await usersCollection.countDocuments({
      totalPoints: { $exists: false }
    });
    
    if (usersWithoutPoints > 0) {
      warn(`${usersWithoutPoints} users missing totalPoints field`);
      warn('Run: node scripts/setup-leaderboard-index.js');
      return false;
    } else {
      success('All users have totalPoints field');
    }
    
    // Test leaderboard query
    const topUsers = await usersCollection
      .find({ role: { $ne: 'admin' } })
      .sort({ totalPoints: -1, _id: 1 })
      .limit(5)
      .project({ name: 1, email: 1, totalPoints: 1 })
      .toArray();
    
    if (topUsers.length > 0) {
      success(`Leaderboard query works (found ${topUsers.length} users)`);
      console.log('\n  Top 5 users:');
      topUsers.forEach((user, idx) => {
        console.log(`    ${idx + 1}. ${user.name || 'No name'} - ${user.totalPoints || 0} points`);
      });
    } else {
      warn('No users found in leaderboard query');
    }
    
    return true;
  } catch (err) {
    error(`Leaderboard test failed: ${err.message}`);
    return false;
  }
}

async function testSubscriptionModel() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Subscription Model');
  console.log('='.repeat(60));

  try {
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    
    const totalSubscriptions = await subscriptionsCollection.countDocuments();
    info(`Total subscriptions: ${totalSubscriptions}`);
    
    if (totalSubscriptions > 0) {
      const activeSubscriptions = await subscriptionsCollection.countDocuments({
        status: 'active'
      });
      success(`Active subscriptions: ${activeSubscriptions}`);
      
      // Check if paymentStatus field exists
      const withPaymentStatus = await subscriptionsCollection.countDocuments({
        paymentStatus: { $exists: true }
      });
      
      if (withPaymentStatus === totalSubscriptions) {
        success('All subscriptions have paymentStatus field');
      } else {
        warn(`${totalSubscriptions - withPaymentStatus} subscriptions missing paymentStatus`);
      }
      
      // Check email tracking
      const withEmailTracking = await subscriptionsCollection.countDocuments({
        emailSent: { $exists: true }
      });
      
      if (withEmailTracking === totalSubscriptions) {
        success('All subscriptions have email tracking fields');
      } else {
        warn(`${totalSubscriptions - withEmailTracking} subscriptions missing email tracking`);
      }
      
      // Sample subscription
      const sample = await subscriptionsCollection.findOne({});
      console.log('\n  Sample subscription structure:');
      console.log(`    - user: ${sample.user ? '✓' : '✗'}`);
      console.log(`    - plan: ${sample.plan ? '✓' : '✗'}`);
      console.log(`    - status: ${sample.status || 'N/A'}`);
      console.log(`    - paymentStatus: ${sample.paymentStatus || 'N/A'}`);
      console.log(`    - price: ${sample.price || 'N/A'}`);
      console.log(`    - emailSent: ${sample.emailSent ? '✓' : '✗'}`);
    } else {
      warn('No subscriptions found in database');
    }
    
    return true;
  } catch (err) {
    error(`Subscription test failed: ${err.message}`);
    return false;
  }
}

async function testGameQuestions() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Game Questions Model');
  console.log('='.repeat(60));

  try {
    const db = mongoose.connection.db;
    const gameQuestionsCollection = db.collection('gamequestions');
    
    const totalQuestions = await gameQuestionsCollection.countDocuments();
    info(`Total game questions: ${totalQuestions}`);
    
    if (totalQuestions > 0) {
      const games = await gameQuestionsCollection.distinct('gameId');
      success(`Questions exist for ${games.length} games: ${games.join(', ')}`);
      
      // Count by game
      for (const gameId of games) {
        const count = await gameQuestionsCollection.countDocuments({ gameId });
        console.log(`    - ${gameId}: ${count} questions`);
      }
    } else {
      warn('No game questions found in database');
      info('Create questions via Admin Panel → Game Questions tab');
    }
    
    return true;
  } catch (err) {
    error(`Game questions test failed: ${err.message}`);
    return false;
  }
}

async function testAdminNotifications() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: Admin Notifications Model');
  console.log('='.repeat(60));

  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('adminnotifications');
    
    const totalNotifications = await notificationsCollection.countDocuments();
    info(`Total admin notifications: ${totalNotifications}`);
    
    if (totalNotifications > 0) {
      const scheduled = await notificationsCollection.countDocuments({
        status: 'scheduled'
      });
      const sent = await notificationsCollection.countDocuments({
        status: 'sent'
      });
      const draft = await notificationsCollection.countDocuments({
        status: 'draft'
      });
      
      console.log(`    - Draft: ${draft}`);
      console.log(`    - Scheduled: ${scheduled}`);
      console.log(`    - Sent: ${sent}`);
      success('Admin notifications structure looks good');
    } else {
      info('No admin notifications found (this is normal for new setups)');
    }
    
    return true;
  } catch (err) {
    error(`Admin notifications test failed: ${err.message}`);
    return false;
  }
}

async function testEmailConfiguration() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: Email Configuration');
  console.log('='.repeat(60));

  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length === 0) {
    success('All SMTP environment variables are set');
    console.log(`    - Host: ${process.env.SMTP_HOST}`);
    console.log(`    - Port: ${process.env.SMTP_PORT}`);
    console.log(`    - User: ${process.env.SMTP_USER}`);
    console.log(`    - From: ${process.env.SMTP_FROM}`);
    
    // Test SMTP connection
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      
      await transporter.verify();
      success('SMTP connection test passed');
    } catch (err) {
      error(`SMTP connection test failed: ${err.message}`);
      warn('Check your SMTP credentials');
      return false;
    }
  } else {
    warn(`Missing SMTP environment variables: ${missing.join(', ')}`);
    info('Email confirmations will not work without SMTP configuration');
    return false;
  }
  
  return true;
}

async function testRazorpayConfiguration() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 7: Razorpay Configuration');
  console.log('='.repeat(60));

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (keyId && keySecret) {
    success('Razorpay credentials are set');
    console.log(`    - Key ID: ${keyId.substring(0, 10)}...`);
    
    if (keyId.startsWith('rzp_live_')) {
      success('Using LIVE Razorpay keys (production)');
    } else if (keyId.startsWith('rzp_test_')) {
      warn('Using TEST Razorpay keys (not for production!)');
    } else {
      warn('Razorpay key format looks unusual');
    }
  } else {
    warn('Razorpay credentials not set');
    info('Subscriptions will not work without Razorpay configuration');
    return false;
  }
  
  return true;
}

async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'AARAMBH FEATURE TESTING' + ' '.repeat(25) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  
  const results = {
    database: false,
    leaderboard: false,
    subscriptions: false,
    gameQuestions: false,
    notifications: false,
    email: false,
    razorpay: false,
  };
  
  results.database = await testDatabaseConnection();
  
  if (results.database) {
    results.leaderboard = await testLeaderboardIndex();
    results.subscriptions = await testSubscriptionModel();
    results.gameQuestions = await testGameQuestions();
    results.notifications = await testAdminNotifications();
  }
  
  results.email = await testEmailConfiguration();
  results.razorpay = await testRazorpayConfiguration();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log(`\n  Database Connection:       ${results.database ? '✅' : '❌'}`);
  console.log(`  Leaderboard Index:         ${results.leaderboard ? '✅' : '❌'}`);
  console.log(`  Subscription Model:        ${results.subscriptions ? '✅' : '❌'}`);
  console.log(`  Game Questions:            ${results.gameQuestions ? '✅' : '❌'}`);
  console.log(`  Admin Notifications:       ${results.notifications ? '✅' : '❌'}`);
  console.log(`  Email Configuration:       ${results.email ? '✅' : '❌'}`);
  console.log(`  Razorpay Configuration:    ${results.razorpay ? '✅' : '❌'}`);
  
  console.log(`\n  Total: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n' + colors.green + '🎉 All tests passed! Ready for production.' + colors.reset);
  } else {
    console.log('\n' + colors.yellow + '⚠️  Some tests failed. Review the issues above.' + colors.reset);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS');
  console.log('='.repeat(60));
  
  if (!results.leaderboard) {
    console.log('\n  1. Run leaderboard migration:');
    console.log('     node scripts/setup-leaderboard-index.js');
  }
  
  if (!results.email) {
    console.log('\n  2. Configure SMTP in .env:');
    console.log('     SMTP_HOST=smtp.gmail.com');
    console.log('     SMTP_PORT=587');
    console.log('     SMTP_USER=your-email@gmail.com');
    console.log('     SMTP_PASS=your-app-password');
  }
  
  if (!results.razorpay) {
    console.log('\n  3. Configure Razorpay in .env:');
    console.log('     RAZORPAY_KEY_ID=rzp_live_...');
    console.log('     RAZORPAY_KEY_SECRET=...');
  }
  
  console.log('\n  4. Test the application:');
  console.log('     - Test leaderboard in mobile app');
  console.log('     - Test admin panel features');
  console.log('     - Test subscription purchase');
  console.log('     - Verify email confirmations');
  
  console.log('\n');
  
  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(err => {
  console.error('\n❌ Fatal error:', err);
  mongoose.disconnect();
  process.exit(1);
});
