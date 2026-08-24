# Account Deletion Feature - Complete Guide

## Overview

This application implements a secure 4-step account deletion process with a 7-day grace period, fully compliant with app store requirements and data protection regulations.

## How It Works

### User Experience

1. **Request Deletion**
   - User opens Settings from the side menu
   - Selects "Delete Account"
   - Sees a clear warning about the 7-day grace period
   - Must explicitly confirm their intent

2. **Schedule & Logout**
   - Account is marked for deletion
   - Scheduled deletion date is set to 7 days from now
   - User is immediately logged out
   - Confirmation message shows the exact deletion date

3. **Grace Period (7 Days)**
   - Account is NOT deleted during this period
   - User can cancel deletion by simply logging in again
   - If user logs in, deletion is automatically cancelled
   - Account returns to normal active state

4. **Permanent Deletion**
   - If user does NOT log in within 7 days
   - Account and all data are permanently deleted
   - Automated cleanup job runs daily to process expired accounts

## Technical Implementation

### Backend Components

#### 1. User Model Fields
```javascript
// Added to User schema in src/models/User.js
deletionPending: Boolean          // Whether deletion is scheduled
deletionRequestedAt: Date         // When deletion was requested
scheduledDeletionAt: Date         // When account will be deleted
```

#### 2. Account Deletion Service
- **Location**: `backend/src/services/accountDeletionService.js`
- **Functions**:
  - `requestAccountDeletion(userId)` - Schedule deletion
  - `cancelAccountDeletion(userId)` - Cancel pending deletion
  - `getDeletionStatus(userId)` - Check deletion status
  - `permanentlyDeleteAccount(userId)` - Delete account and data
  - `runCleanupJob()` - Process all expired accounts

#### 3. API Endpoints
- **POST** `/api/user/request-deletion` - Request account deletion (requires auth)
- **POST** `/api/user/cancel-deletion` - Cancel deletion (requires auth)
- **GET** `/api/user/deletion-status` - Get deletion status (requires auth)

#### 4. Login Logic
- Checks if account has pending deletion on login
- If grace period NOT expired: Cancels deletion and allows login
- If grace period expired: Permanently deletes account and rejects login

#### 5. Automated Cleanup
- **Scheduler**: `backend/src/services/accountDeletionScheduler.js`
- **Default Schedule**: 2:00 AM UTC daily (7:30 AM IST)
- **Configurable via**: `ACCOUNT_DELETION_SCHEDULE` environment variable
- **Cron Format**: `minute hour day month weekday`

### Frontend Components

#### 1. Settings Screen
- **Location**: `frontend/app/settings.tsx`
- Shows current deletion status
- Implements 4-step deletion flow with proper warnings
- Uses Alert dialogs for confirmation

#### 2. Sidebar Integration
- Added "Settings" menu item at the top of the side menu
- Navigates to the Settings screen

#### 3. Login Flow
- Updated to detect `deletionCancelled` flag in auth response
- Shows welcome back message when deletion is cancelled

## Environment Variables

### Required (Render Deployment)

```bash
# Account Deletion Cleanup Schedule
# Default: 0 2 * * * (2:00 AM UTC / 7:30 AM IST daily)
ACCOUNT_DELETION_SCHEDULE=0 2 * * *

# Run cleanup on server startup (for testing)
# Default: false (set to true only for testing)
RUN_DELETION_CLEANUP_ON_STARTUP=false
```

### Local Development

Add to `backend/.env`:
```bash
ACCOUNT_DELETION_SCHEDULE=0 2 * * *
RUN_DELETION_CLEANUP_ON_STARTUP=false
```

## Data Deletion Details

When an account is permanently deleted, the following data is removed:

1. **User Record** - The user document in MongoDB
2. **Device Tokens** - All FCM push notification tokens
3. **In-App Notifications** - All notification history
4. **Notification Logs** - All notification tracking data

### Add Additional Deletions

If you need to delete more user-related data (chat messages, subscriptions, etc.), update the `permanentlyDeleteAccount` function in `backend/src/services/accountDeletionService.js`:

```javascript
await Promise.all([
  DeviceToken.deleteMany({ userId }),
  InAppNotification.deleteMany({ user: userId }),
  NotificationLog.deleteMany({ userId }),
  // Add more deletions here:
  // ChatMessage.deleteMany({ user: userId }),
  // Subscription.deleteMany({ user: userId }),
  // etc.
]);
```

## Monitoring & Testing

### Check Scheduler Status

The scheduler logs its status on server startup:
```
📅 Account deletion cleanup scheduler configured for: 0 2 * * * (UTC)
✅ Account deletion cleanup scheduler started
```

### Manual Cleanup Trigger

For testing or emergency cleanup, you can manually trigger the cleanup job:

```javascript
const { triggerCleanupNow } = require('./src/services/accountDeletionScheduler');
const results = await triggerCleanupNow();
console.log(results);
```

### Cleanup Job Logs

When the cleanup job runs, it logs:
```
⏰ Account deletion cleanup time - checking for expired accounts...
🧹 Account deletion cleanup: Found X expired accounts
✅ Permanently deleted account: user@example.com (userId)
✅ Account deletion cleanup completed: X deleted, Y errors
```

## Security Considerations

1. **Server-Side Enforcement**
   - Deletion state is stored in MongoDB, not client storage
   - Grace period validation happens on the backend
   - Client cannot manipulate deletion timestamps

2. **Device Independence**
   - Works across device changes and app reinstalls
   - User can login from any device to cancel deletion
   - No reliance on local storage or device state

3. **Automatic Cleanup**
   - Scheduled job ensures timely deletion
   - No manual intervention required
   - Handles errors and logs failures

4. **Protected API Endpoints**
   - All deletion APIs require authentication
   - Only the account owner can request/cancel deletion
   - Protected by JWT middleware

## User Flow Diagrams

### Deletion Request Flow
```
User in App
    ↓
Opens Settings
    ↓
Clicks "Delete Account"
    ↓
Sees 7-day warning
    ↓
Confirms deletion
    ↓
Backend sets deletionPending=true
Backend calculates scheduledDeletionAt
    ↓
User logged out
    ↓
[7-day grace period begins]
```

### Grace Period Cancellation Flow
```
Deleted Account
    ↓
User tries to login
    ↓
Backend checks deletionPending
    ↓
Is scheduledDeletionAt passed?
    ├── No → Cancel deletion
    │        Set deletionPending=false
    │        Allow login
    │        Show "Welcome Back" message
    │
    └── Yes → Permanently delete account
             Reject login
             Show "Account deleted" error
```

### Automated Cleanup Flow
```
Scheduled Time (2:00 AM UTC)
    ↓
Scheduler triggers cleanup
    ↓
Find all accounts where:
  - deletionPending = true
  - scheduledDeletionAt <= now
    ↓
For each expired account:
  - Delete device tokens
  - Delete notifications
  - Delete notification logs
  - Delete user record
    ↓
Log results and errors
```

## Compliance Notes

This implementation satisfies:

1. **Google Play Store Requirements**
   - In-app account deletion
   - Clear user communication
   - Grace period for recovery
   - Complete data deletion

2. **GDPR / Data Protection**
   - Right to erasure (right to be forgotten)
   - Clear notification of deletion timeline
   - Permanent removal of personal data
   - User control over their data

3. **Best Practices**
   - Non-immediate deletion with grace period
   - Multiple confirmation steps
   - Clear communication at each step
   - Automatic recovery mechanism

## Troubleshooting

### Issue: Scheduler not running
**Solution**: Check server logs for initialization messages. Verify cron format is correct.

### Issue: Accounts not being deleted
**Solution**: Check that `scheduledDeletionAt` is in the past and `deletionPending` is true. Run manual cleanup to test.

### Issue: User cannot cancel deletion
**Solution**: Verify login flow is calling `cancelAccountDeletion` when `deletionPending` is true. Check for clock skew between client and server.

### Issue: User sees deletion warning after cancelling
**Solution**: Ensure frontend is fetching fresh deletion status from `/api/user/deletion-status` and not using cached data.

## Testing Checklist

- [ ] User can access Settings from side menu
- [ ] Delete Account shows proper warning
- [ ] Confirmation dialog requires explicit action
- [ ] Account is marked for deletion in database
- [ ] User is logged out after confirmation
- [ ] Scheduled deletion date is 7 days in future
- [ ] User can login during grace period
- [ ] Login cancels deletion automatically
- [ ] Welcome back message is shown
- [ ] Account returns to active state
- [ ] If 7 days pass, account is deleted
- [ ] Automated cleanup job runs on schedule
- [ ] All user data is removed
- [ ] Login after expiry shows proper error

## Support & Maintenance

For any issues or questions about the account deletion feature:

1. Check server logs for scheduler and cleanup messages
2. Verify environment variables are set correctly
3. Test the flow manually with a test account
4. Review the MongoDB User collection for deletion fields

## Future Enhancements

Possible improvements for the future:

1. **Email Notifications**
   - Send email when deletion is scheduled
   - Send reminder emails before permanent deletion
   - Send confirmation email after cancellation

2. **Admin Dashboard**
   - View pending deletions
   - Manual override for deletions
   - Deletion statistics and reports

3. **Export Data Before Deletion**
   - Allow users to download their data
   - Include in deletion flow
   - Comply with data portability requirements

4. **Configurable Grace Period**
   - Allow different grace periods per user type
   - Make grace period configurable in settings

5. **Soft Delete Option**
   - Keep anonymized data for analytics
   - Separate personal data from usage data
   - Implement multi-tier deletion
