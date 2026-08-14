/**
 * Database Migration Script: Setup Leaderboard Index
 * 
 * This script:
 * 1. Creates the compound index required for leaderboard performance
 * 2. Initializes totalPoints for any users missing it
 * 3. Verifies the index was created successfully
 * 
 * Run this in production to fix leaderboard issues.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or MONGO_URI not found in environment variables');
  process.exit(1);
}

async function setupLeaderboardIndex() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Step 1: Check current indexes
    console.log('\n📋 Current indexes on users collection:');
    const existingIndexes = await usersCollection.indexes();
    existingIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Step 2: Create the compound index if it doesn't exist
    console.log('\n🔄 Creating compound index { totalPoints: -1, _id: 1 }...');
    try {
      await usersCollection.createIndex(
        { totalPoints: -1, _id: 1 },
        { name: 'totalPoints_-1__id_1', background: true }
      );
      console.log('✅ Index created successfully');
    } catch (error) {
      if (error.code === 85 || error.message.includes('already exists')) {
        console.log('ℹ️  Index already exists');
      } else {
        throw error;
      }
    }

    // Step 3: Initialize totalPoints for users who don't have it
    console.log('\n🔄 Checking for users without totalPoints field...');
    const usersWithoutPoints = await usersCollection.countDocuments({
      totalPoints: { $exists: false }
    });
    
    if (usersWithoutPoints > 0) {
      console.log(`📊 Found ${usersWithoutPoints} users without totalPoints`);
      console.log('🔄 Initializing totalPoints to 0...');
      
      const result = await usersCollection.updateMany(
        { totalPoints: { $exists: false } },
        { $set: { totalPoints: 0 } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} users`);
    } else {
      console.log('✅ All users already have totalPoints field');
    }

    // Step 4: Verify the index
    console.log('\n📋 Final indexes on users collection:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Step 5: Show sample data
    console.log('\n📊 Sample leaderboard data (top 5 users):');
    const topUsers = await usersCollection
      .find({ role: { $ne: 'admin' } })
      .sort({ totalPoints: -1, _id: 1 })
      .limit(5)
      .project({ name: 1, email: 1, totalPoints: 1 })
      .toArray();
    
    if (topUsers.length > 0) {
      topUsers.forEach((user, idx) => {
        console.log(`  ${idx + 1}. ${user.name || 'No name'} (${user.email}) - ${user.totalPoints || 0} points`);
      });
    } else {
      console.log('  No users found');
    }

    // Step 6: Count total users
    const totalUsers = await usersCollection.countDocuments({ role: { $ne: 'admin' } });
    console.log(`\n📊 Total non-admin users: ${totalUsers}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Test the leaderboard endpoint: GET /api/leaderboard');
    console.log('  3. Check the leaderboard in the mobile app');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the migration
setupLeaderboardIndex();
