const User = require('../models/User');
const DeviceToken = require('../models/DeviceToken');
const InAppNotification = require('../models/InAppNotification');
const NotificationLog = require('../models/NotificationLog');

const DELETION_GRACE_PERIOD_DAYS = 7;

/**
 * Request account deletion for a user
 * Marks the account for deletion after 7 days
 */
async function requestAccountDeletion(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.deletionPending) {
    throw new Error('Account deletion is already pending');
  }

  const now = new Date();
  const scheduledDeletion = new Date(now);
  scheduledDeletion.setDate(scheduledDeletion.getDate() + DELETION_GRACE_PERIOD_DAYS);

  user.deletionPending = true;
  user.deletionRequestedAt = now;
  user.scheduledDeletionAt = scheduledDeletion;
  await user.save();

  return {
    deletionRequestedAt: now,
    scheduledDeletionAt: scheduledDeletion,
    gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
  };
}

/**
 * Cancel pending account deletion
 * Called when user logs in during grace period
 */
async function cancelAccountDeletion(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.deletionPending) {
    return { wasCancelled: false };
  }

  // Check if deletion period has expired
  const now = new Date();
  if (user.scheduledDeletionAt && user.scheduledDeletionAt <= now) {
    throw new Error('Deletion grace period has expired. Account will be permanently deleted.');
  }

  user.deletionPending = false;
  user.deletionRequestedAt = null;
  user.scheduledDeletionAt = null;
  await user.save();

  return { wasCancelled: true };
}

/**
 * Get account deletion status
 */
async function getDeletionStatus(userId) {
  const user = await User.findById(userId).select(
    'deletionPending deletionRequestedAt scheduledDeletionAt'
  );

  if (!user) {
    throw new Error('User not found');
  }

  return {
    deletionPending: user.deletionPending || false,
    deletionRequestedAt: user.deletionRequestedAt || null,
    scheduledDeletionAt: user.scheduledDeletionAt || null,
    gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
  };
}

/**
 * Permanently delete a user account and all associated data
 */
async function permanentlyDeleteAccount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return { deleted: false, reason: 'User not found' };
  }

  try {
    // Delete all associated data
    await Promise.all([
      DeviceToken.deleteMany({ userId }),
      InAppNotification.deleteMany({ user: userId }),
      NotificationLog.deleteMany({ userId }),
      // Add other user-related data deletions here as needed
      // e.g., chat messages, subscriptions, etc.
    ]);

    // Finally delete the user
    await User.findByIdAndDelete(userId);

    console.log(`✅ Permanently deleted account: ${user.email} (${userId})`);
    return { deleted: true, email: user.email };
  } catch (error) {
    console.error(`❌ Error deleting account ${userId}:`, error);
    throw error;
  }
}

/**
 * Find all accounts that should be permanently deleted
 * (deletion pending and scheduled deletion time has passed)
 */
async function findExpiredAccounts() {
  const now = new Date();
  return await User.find({
    deletionPending: true,
    scheduledDeletionAt: { $lte: now },
  }).select('_id email scheduledDeletionAt');
}

/**
 * Run cleanup job to delete expired accounts
 * Returns statistics about deleted accounts
 */
async function runCleanupJob() {
  const expiredAccounts = await findExpiredAccounts();

  if (expiredAccounts.length === 0) {
    console.log('🧹 Account deletion cleanup: No expired accounts found');
    return { deletedCount: 0, errors: [] };
  }

  console.log(`🧹 Account deletion cleanup: Found ${expiredAccounts.length} expired accounts`);

  const results = {
    deletedCount: 0,
    errors: [],
  };

  for (const account of expiredAccounts) {
    try {
      await permanentlyDeleteAccount(account._id);
      results.deletedCount++;
    } catch (error) {
      results.errors.push({
        userId: account._id,
        email: account.email,
        error: error.message,
      });
    }
  }

  console.log(
    `✅ Account deletion cleanup completed: ${results.deletedCount} deleted, ${results.errors.length} errors`
  );
  return results;
}

module.exports = {
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  permanentlyDeleteAccount,
  findExpiredAccounts,
  runCleanupJob,
  DELETION_GRACE_PERIOD_DAYS,
};
