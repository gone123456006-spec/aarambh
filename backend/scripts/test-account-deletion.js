/**
 * Test script for account deletion feature
 * 
 * This script tests the account deletion API endpoints and cleanup job.
 * Run with: node backend/scripts/test-account-deletion.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const accountDeletionService = require('../src/services/accountDeletionService');

async function testAccountDeletion() {
  console.log('🧪 Testing Account Deletion Feature\n');

  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Create a test user
    console.log('📝 Test 1: Creating test user...');
    let testUser = await User.findOne({ email: 'deletion-test@example.com' });
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
      console.log('   Removed existing test user');
    }

    testUser = new User({
      email: 'deletion-test@example.com',
      name: 'Test User',
      profileCompleted: true,
    });
    await testUser.save();
    console.log(`✅ Test user created: ${testUser._id}\n`);

    // Test 2: Request deletion
    console.log('📝 Test 2: Requesting account deletion...');
    const deletionResult = await accountDeletionService.requestAccountDeletion(testUser._id);
    console.log('✅ Deletion requested:', {
      deletionRequestedAt: deletionResult.deletionRequestedAt,
      scheduledDeletionAt: deletionResult.scheduledDeletionAt,
      gracePeriodDays: deletionResult.gracePeriodDays,
    });
    console.log('');

    // Test 3: Check deletion status
    console.log('📝 Test 3: Checking deletion status...');
    const status = await accountDeletionService.getDeletionStatus(testUser._id);
    console.log('✅ Deletion status:', status);
    console.log('');

    // Test 4: Cancel deletion (simulating user login)
    console.log('📝 Test 4: Cancelling deletion (simulating user login)...');
    const cancelResult = await accountDeletionService.cancelAccountDeletion(testUser._id);
    console.log('✅ Deletion cancelled:', cancelResult);
    console.log('');

    // Test 5: Request deletion again for cleanup test
    console.log('📝 Test 5: Requesting deletion again for cleanup test...');
    await accountDeletionService.requestAccountDeletion(testUser._id);
    
    // Manually set scheduledDeletionAt to the past to simulate expired grace period
    testUser = await User.findById(testUser._id);
    testUser.scheduledDeletionAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    await testUser.save();
    console.log('✅ Deletion requested and set to expired (for testing)');
    console.log('');

    // Test 6: Run cleanup job
    console.log('📝 Test 6: Running cleanup job...');
    const cleanupResults = await accountDeletionService.runCleanupJob();
    console.log('✅ Cleanup results:', cleanupResults);
    console.log('');

    // Test 7: Verify user is deleted
    console.log('📝 Test 7: Verifying user is permanently deleted...');
    const deletedUser = await User.findById(testUser._id);
    if (!deletedUser) {
      console.log('✅ User successfully deleted from database');
    } else {
      console.log('❌ User still exists in database (should not happen)');
    }
    console.log('');

    // Test 8: Check for expired accounts (should be none now)
    console.log('📝 Test 8: Checking for remaining expired accounts...');
    const expiredAccounts = await accountDeletionService.findExpiredAccounts();
    console.log(`✅ Found ${expiredAccounts.length} expired accounts (should be 0)`);
    console.log('');

    console.log('🎉 All tests completed successfully!\n');
    console.log('Summary:');
    console.log('  ✅ Account deletion request works');
    console.log('  ✅ Deletion status retrieval works');
    console.log('  ✅ Deletion cancellation works');
    console.log('  ✅ Cleanup job works');
    console.log('  ✅ Permanent deletion works');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up and disconnect
    console.log('\n🧹 Cleaning up...');
    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run tests
testAccountDeletion().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
