const cron = require('node-cron');
const dailyNotificationService = require('./dailyNotificationService');

let scheduledTask = null;

/**
 * Start the daily notification scheduler.
 * By default, sends notifications at 10:00 AM IST (Indian Standard Time) every day.
 * You can customize the time using environment variables.
 */
function startDailyNotificationScheduler() {
  // Get schedule from environment or use default (10:00 AM IST)
  // Cron format: minute hour day month weekday
  // IST is UTC+5:30, so 10:00 AM IST = 4:30 AM UTC
  const schedule = process.env.DAILY_NOTIFICATION_SCHEDULE || '30 4 * * *';

  console.log(`📅 Daily notification scheduler configured for: ${schedule} (IST 10:00 AM)`);

  // Schedule the daily notification task
  scheduledTask = cron.schedule(schedule, async () => {
    console.log('⏰ Daily notification time - starting broadcast...');
    try {
      const stats = await dailyNotificationService.sendDailyNotificationsToAllUsers();
      console.log(`📊 Daily notification stats:`, stats);
    } catch (error) {
      console.error('❌ Daily notification scheduler error:', error);
    }
  });

  console.log('✅ Daily notification scheduler started');

  // Optional: Send a test notification on startup (disabled by default)
  if (process.env.SEND_TEST_NOTIFICATION_ON_STARTUP === 'true') {
    console.log('📤 Sending test daily notification on startup...');
    setTimeout(async () => {
      try {
        const stats = await dailyNotificationService.sendDailyNotificationsToAllUsers();
        console.log('📊 Startup test notification stats:', stats);
      } catch (error) {
        console.error('❌ Startup test notification error:', error);
      }
    }, 5000); // Wait 5 seconds after server starts
  }

  return scheduledTask;
}

/**
 * Stop the daily notification scheduler.
 */
function stopDailyNotificationScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('🛑 Daily notification scheduler stopped');
  }
}

/**
 * Manually trigger daily notifications (for testing).
 */
async function triggerDailyNotificationsNow() {
  console.log('🔔 Manually triggering daily notifications...');
  return dailyNotificationService.sendDailyNotificationsToAllUsers();
}

module.exports = {
  startDailyNotificationScheduler,
  stopDailyNotificationScheduler,
  triggerDailyNotificationsNow,
};
