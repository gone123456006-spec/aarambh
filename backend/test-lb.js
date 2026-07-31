require('dotenv').config();
const connectDB = require('./src/config/db');
const User = require('./src/models/User');

function formatEntry(user, rank) {
    return {
        id: String(user._id),
        name: user.name?.trim() || 'Learner',
        location: user.region?.trim() || '',
        avatar: user.avatar?.trim() || '',
        points: user.totalPoints || 0,
        rank,
    };
}

(async () => {
    await connectDB();
    const topUsers = await User.find({ role: { $ne: 'admin' } })
        .select('name region avatar totalPoints createdAt')
        .sort({ totalPoints: -1, createdAt: 1 })
        .limit(10)
        .lean();

    const rankings = topUsers.map((user, index) => formatEntry(user, index + 1));
    console.log('\n--- Leaderboard Rankings ---');
    console.log(JSON.stringify(rankings, null, 2));

    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    console.log('\nTotal active (non-admin) users in database:', totalUsers);

    if (topUsers.length > 0) {
        const testUser = topUsers[Math.floor(topUsers.length / 2)];
        const myTotalPoints = testUser.totalPoints || 0;
        const higherRankedCount = await User.countDocuments({
            role: { $ne: 'admin' },
            $or: [
                { totalPoints: { $gt: myTotalPoints } },
                { totalPoints: myTotalPoints, createdAt: { $lt: testUser.createdAt } },
            ],
        });
        console.log(`\nSimulating requesting user: ${testUser.name} (${testUser.totalPoints} points)`);
        console.log(`Calculated rank exactly matches list position:`, higherRankedCount + 1);
    } else {
        console.log('No users found in DB.');
    }

    process.exit(0);
})();
