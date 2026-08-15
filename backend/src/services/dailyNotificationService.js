const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const DeviceToken = require('../models/DeviceToken');
const firebaseService = require('./firebaseService');

/**
 * Pool of engaging notification messages for daily automated notifications.
 * Each message has a title, body, and optional data for app routing.
 */
const NOTIFICATION_MESSAGES = [
  // Learning & Practice
  {
    key: 'practice_daily',
    title: '🎯 Daily Practice Time!',
    body: 'Spend just 10 minutes today practicing English. Consistency is the key to fluency!',
    data: { type: 'my_courses', route: '/my-courses' },
  },
  {
    key: 'new_lesson',
    title: '📚 New Lessons Waiting!',
    body: 'Explore new English lessons and improve your skills today.',
    data: { type: 'my_courses', route: '/my-courses' },
  },
  {
    key: 'keep_learning',
    title: '🌟 Keep Learning!',
    body: 'Every day you learn is a step closer to English fluency. Start a lesson today!',
    data: { type: 'my_courses', route: '/my-courses' },
  },
  
  // Social & Chat
  {
    key: 'meet_learners',
    title: '👥 Meet New English Learners',
    body: 'Connect with other learners and practice speaking English together!',
    data: { type: 'random_chat', route: '/random-chat' },
  },
  {
    key: 'chat_practice',
    title: '💬 Practice English Chat Today',
    body: 'Join a conversation with other learners. Real practice makes perfect!',
    data: { type: 'random_chat', route: '/random-chat' },
  },
  {
    key: 'speak_english',
    title: '🗣️ Speak English Today!',
    body: 'Don\'t be shy! Join a chat room and practice your speaking skills.',
    data: { type: 'random_chat', route: '/random-chat' },
  },
  
  // Subscription & Premium
  {
    key: 'unlock_courses',
    title: '🔓 Unlock All Courses',
    body: 'Get unlimited access to all English courses. Start your premium journey today!',
    data: { type: 'subscription', route: '/my-courses' },
  },
  {
    key: 'premium_benefits',
    title: '⭐ Go Premium, Learn Faster',
    body: 'Premium members learn 3x faster! Unlock advanced courses and exclusive content.',
    data: { type: 'subscription', route: '/my-courses' },
  },
  {
    key: 'limited_offer',
    title: '🎁 Special Offer Inside!',
    body: 'Limited time offer on premium subscriptions. Check it out now!',
    data: { type: 'subscription', route: '/my-courses' },
  },
  
  // Motivation & Engagement
  {
    key: 'you_can_do_it',
    title: '💪 You Can Do This!',
    body: 'English fluency is within your reach. Start learning today!',
    data: { type: 'home', route: '/' },
  },
  {
    key: 'dont_give_up',
    title: '🚀 Don\'t Give Up!',
    body: 'Every expert was once a beginner. Keep practicing and you\'ll succeed!',
    data: { type: 'home', route: '/' },
  },
  {
    key: 'daily_streak',
    title: '🔥 Build Your Streak',
    body: 'Open the app daily to maintain your learning streak. You\'re doing great!',
    data: { type: 'home', route: '/' },
  },
  
  // Game & Fun
  {
    key: 'play_game',
    title: '🎮 Play & Learn English',
    body: 'Make learning fun! Play our English games and earn points.',
    data: { type: 'games', route: '/games' },
  },
  {
    key: 'leaderboard',
    title: '🏆 Check the Leaderboard',
    body: 'See where you rank among other learners. Can you reach the top?',
    data: { type: 'leaderboard', route: '/leaderboard' },
  },
  
  // Progress & Achievement
  {
    key: 'track_progress',
    title: '📊 Track Your Progress',
    body: 'See how far you\'ve come! Check your learning progress today.',
    data: { type: 'performance', route: '/performance' },
  },
  {
    key: 'celebrate_wins',
    title: '🎉 Celebrate Your Wins',
    body: 'You\'ve made amazing progress! Keep going and reach new milestones.',
    data: { type: 'performance', route: '/performance' },
  },
  
  // Community
  {
    key: 'join_community',
    title: '🤝 Join Our Community',
    body: 'Connect with thousands of English learners. Learn together, grow together!',
    data: { type: 'random_chat', route: '/random-chat' },
  },
  {
    key: 'make_friends',
    title: '👫 Make Friends While Learning',
    body: 'Learning is better with friends! Meet people and practice English together.',
    data: { type: 'random_chat', route: '/random-chat' },
  },
];

/**
 * Check if a user should receive a daily notification today.
 * Returns true if they haven't received one in the last 24 hours.
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function shouldSendDailyNotification(userId) {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const recentLog = await NotificationLog.findOne({
    userId,
    notificationType: 'daily_engagement',
    lastSentAt: { $gte: yesterday },
  });

  return !recentLog;
}

/**
 * Select a random notification message from the pool.
 * Tries to avoid sending the same message as last time.
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Selected notification message
 */
async function selectRandomMessage(userId) {
  // Get last sent message key
  const lastLog = await NotificationLog.findOne({
    userId,
    notificationType: 'daily_engagement',
  })
    .sort({ lastSentAt: -1 })
    .limit(1);

  const lastMessageKey = lastLog?.messageKey;

  // Filter out the last sent message to avoid repetition
  const availableMessages = lastMessageKey
    ? NOTIFICATION_MESSAGES.filter((msg) => msg.key !== lastMessageKey)
    : NOTIFICATION_MESSAGES;

  // Select random message
  const randomIndex = Math.floor(Math.random() * availableMessages.length);
  return availableMessages[randomIndex] || NOTIFICATION_MESSAGES[0];
}

/**
 * Send daily engagement notification to a single user.
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - True if notification was sent
 */
async function sendDailyNotificationToUser(userId) {
  try {
    // Check if user should receive notification today
    const shouldSend = await shouldSendDailyNotification(userId);
    if (!shouldSend) {
      return false;
    }

    // Check if user has active device tokens
    const hasActiveTokens = await DeviceToken.exists({
      userId,
      isActive: true,
    });

    if (!hasActiveTokens) {
      return false;
    }

    // Select random notification message
    const message = await selectRandomMessage(userId);

    // Send notification
    const result = await firebaseService.sendToUsers(
      [userId],
      {
        title: message.title,
        body: message.body,
      },
      message.data
    );

    // Log the notification
    await NotificationLog.create({
      userId,
      notificationType: 'daily_engagement',
      lastSentAt: new Date(),
      messageKey: message.key,
      delivered: result.successCount > 0,
    });

    return result.successCount > 0;
  } catch (error) {
    console.error(`Failed to send daily notification to user ${userId}:`, error);
    return false;
  }
}

/**
 * Send daily engagement notifications to all eligible users.
 * This should be called once per day by the scheduler.
 * @returns {Promise<Object>} - Stats about notifications sent
 */
async function sendDailyNotificationsToAllUsers() {
  if (!firebaseService.isFirebaseEnabled()) {
    console.log('Firebase not enabled, skipping daily notifications');
    return { totalSent: 0, failed: 0, skipped: 0 };
  }

  console.log('🔔 Starting daily notification broadcast...');

  const stats = {
    totalSent: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Get all users with active device tokens
    const usersWithTokens = await DeviceToken.distinct('userId', {
      isActive: true,
    });

    console.log(`Found ${usersWithTokens.length} users with active device tokens`);

    // Send notifications in batches to avoid overwhelming the system
    const BATCH_SIZE = 50;
    for (let i = 0; i < usersWithTokens.length; i += BATCH_SIZE) {
      const batch = usersWithTokens.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (userId) => {
        const sent = await sendDailyNotificationToUser(userId);
        if (sent) {
          stats.totalSent++;
        } else {
          stats.skipped++;
        }
      });

      await Promise.allSettled(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < usersWithTokens.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `✅ Daily notifications complete: ${stats.totalSent} sent, ${stats.skipped} skipped, ${stats.failed} failed`
    );
  } catch (error) {
    console.error('Error sending daily notifications:', error);
    stats.failed++;
  }

  return stats;
}

/**
 * Get daily notification stats for admin dashboard.
 * @returns {Promise<Object>}
 */
async function getDailyNotificationStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalToday, totalAllTime, usersWithNotifications] = await Promise.all([
    NotificationLog.countDocuments({
      notificationType: 'daily_engagement',
      createdAt: { $gte: today },
    }),
    NotificationLog.countDocuments({
      notificationType: 'daily_engagement',
    }),
    NotificationLog.distinct('userId', {
      notificationType: 'daily_engagement',
    }),
  ]);

  return {
    sentToday: totalToday,
    totalAllTime,
    uniqueUsers: usersWithNotifications.length,
  };
}

module.exports = {
  sendDailyNotificationToUser,
  sendDailyNotificationsToAllUsers,
  shouldSendDailyNotification,
  getDailyNotificationStats,
  NOTIFICATION_MESSAGES,
};
