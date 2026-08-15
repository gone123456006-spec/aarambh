const cron = require('node-cron');
const accountDeletionService = require('./accountDeletionService');

let cleanupTask = null;

/**
 * Start the account deletion cleanup scheduler.
 * By default, runs at 2:00 AM UTC (7:30 AM IST) every day.
 * You can customize the time using environment variables.
 */
function startAccountDeletionScheduler() {
  // Get schedule from environment or use default (2:00 AM UTC / 7:30 AM IST)
  // Cron format: minute hour day month weekday
  const schedule = process.env.ACCOUNT_DELETION_SCHEDULE || '0 2 * * *';

  console.log(`📅 Account deletion cleanup scheduler configured for: ${schedule} (UTC)`);

  // Schedule the cleanup task
  cleanupTask = cron.schedule(schedule, async () => {
    console.log('⏰ Account deletion cleanup time - checking for expired accounts...');
    try {
      const results = await accountDeletionService.runCleanupJob();
      if (results.deletedCount > 0) {
        console.log(`🗑️  Permanently deleted ${results.deletedCount} account(s)`);
      }
      if (results.errors.length > 0) {
        console.error(`❌ ${results.errors.length} error(s) during cleanup:`, results.errors);
      }
    } catch (error) {
      console.error('❌ Account deletion scheduler error:', error);
    }
  });

  console.log('✅ Account deletion cleanup scheduler started');

  // Optional: Run cleanup on startup (disabled by default)
  if (process.env.RUN_DELETION_CLEANUP_ON_STARTUP === 'true') {
    console.log('🧹 Running account deletion cleanup on startup...');
    setTimeout(async () => {
      try {
        const results = await accountDeletionService.runCleanupJob();
        console.log('📊 Startup cleanup results:', results);
      } catch (error) {
        console.error('❌ Startup cleanup error:', error);
      }
    }, 5000); // Wait 5 seconds after server starts
  }

  return cleanupTask;
}

/**
 * Stop the account deletion cleanup scheduler.
 */
function stopAccountDeletionScheduler() {
  if (cleanupTask) {
    cleanupTask.stop();
    console.log('🛑 Account deletion cleanup scheduler stopped');
  }
}

/**
 * Manually trigger account deletion cleanup (for testing).
 */
async function triggerCleanupNow() {
  console.log('🧹 Manually triggering account deletion cleanup...');
  return accountDeletionService.runCleanupJob();
}

module.exports = {
  startAccountDeletionScheduler,
  stopAccountDeletionScheduler,
  triggerCleanupNow,
};
