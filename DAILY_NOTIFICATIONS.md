# Automatic Daily Notification System

This document explains how the automatic daily notification system works in the Ohm's English Learning app.

## Overview

The system automatically sends engaging push notifications to users **once per day** to encourage:
- Daily learning practice
- Social interaction (chat with other learners)
- Premium subscription upgrades
- General motivation and engagement

## Features

### ✅ Smart Delivery
- **One notification per user per day** (rate limited)
- Messages are randomly selected from a diverse pool
- Avoids sending the same message twice in a row
- Only sends to users with active device tokens (app installed)
- Respects users who have uninstalled or disabled notifications

### ✅ Message Variety
18+ different notification messages across categories:
- 📚 Learning & Practice (3 messages)
- 👥 Social & Chat (3 messages)
- 🔓 Subscription & Premium (3 messages)
- 💪 Motivation & Engagement (3 messages)
- 🎮 Game & Fun (2 messages)
- 📊 Progress & Achievement (2 messages)
- 🤝 Community (2 messages)

### ✅ Customizable Schedule
- Default: **10:00 AM IST** every day
- Configurable via environment variable
- Can be triggered manually from admin panel for testing

## How It Works

### 1. Scheduling
The system uses `node-cron` to run a scheduled task:
```javascript
// Default schedule: 10:00 AM IST (4:30 AM UTC)
'30 4 * * *'
```

### 2. User Eligibility Check
Before sending, the system checks:
1. Has the user received a notification in the last 24 hours? (Skip if yes)
2. Does the user have an active device token? (Skip if no)
3. Is Firebase Cloud Messaging enabled? (Skip all if no)

### 3. Message Selection
- Randomly selects from the message pool
- Avoids the last sent message to prevent repetition
- Each message includes:
  - Title
  - Body text
  - Custom data for in-app routing

### 4. Delivery
- Sends notification via Firebase Cloud Messaging
- Logs the delivery (success/failure)
- Updates "last sent" timestamp for the user

### 5. Tracking
All notifications are logged in the database:
- User ID
- Notification type
- Message key
- Timestamp
- Delivery status

## Configuration

### Environment Variables

Edit `d:\aarambh\backend\.env`:

```env
# Schedule (cron format)
DAILY_NOTIFICATION_SCHEDULE=30 4 * * *

# Test mode (send on server startup)
SEND_TEST_NOTIFICATION_ON_STARTUP=false
```

### Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `30 4 * * *` | 10:00 AM IST (default) |
| `0 0 * * *` | 5:30 AM IST |
| `0 9 * * *` | 2:30 PM IST |
| `0 12 * * *` | 5:30 PM IST |
| `30 14 * * *` | 8:00 PM IST |
| `0 6 * * 1,3,5` | 11:30 AM IST (Mon, Wed, Fri only) |

Cron format: `minute hour day month weekday`

**Note**: Times are in UTC, so subtract 5:30 from IST:
- 10:00 AM IST = 4:30 AM UTC = `30 4 * * *`

## Admin Panel Features

### Dashboard Stats
The admin panel shows:
- **Active Devices**: Total users with registered device tokens
- **Users with Notifications**: Unique users who have received notifications
- **Total Sent**: All-time notification count
- **FCM Status**: Firebase Cloud Messaging connection status
- **Daily Stats**: Today's count and all-time daily notification count

### Manual Testing
Admin can manually trigger daily notifications:
1. Go to Admin Panel → Notifications tab
2. Click "⚡ Trigger Daily Notifications Now (Test)"
3. Confirm the action
4. System will send to all eligible users immediately

### Message Pool Viewer
View all 18+ notification messages:
1. Click "📋 View Message Pool"
2. See full list of messages with titles and bodies
3. Helps admins understand what users receive

## API Endpoints

### Admin Endpoints
```
GET  /api/admin/push-notifications/stats
     - Get notification statistics including daily stats

GET  /api/admin/push-notifications/daily-config
     - Get daily notification configuration and message pool

POST /api/admin/push-notifications/trigger-daily
     - Manually trigger daily notifications now
```

## Message Pool

Current categories and sample messages:

### Learning & Practice
- "🎯 Daily Practice Time! - Spend just 10 minutes today practicing English..."
- "📚 New Lessons Waiting! - Explore new English lessons..."
- "🌟 Keep Learning! - Every day you learn is a step closer..."

### Social & Chat
- "👥 Meet New English Learners - Connect with other learners..."
- "💬 Practice English Chat Today - Join a conversation..."
- "🗣️ Speak English Today! - Don't be shy! Join a chat room..."

### Subscription
- "🔓 Unlock All Courses - Get unlimited access..."
- "⭐ Go Premium, Learn Faster - Premium members learn 3x faster..."
- "🎁 Special Offer Inside! - Limited time offer..."

### Motivation
- "💪 You Can Do This! - English fluency is within your reach..."
- "🚀 Don't Give Up! - Every expert was once a beginner..."
- "🔥 Build Your Streak - Open the app daily..."

## Adding New Messages

To add new notification messages, edit:
`d:\aarambh\backend\src\services\dailyNotificationService.js`

```javascript
const NOTIFICATION_MESSAGES = [
  // Add new message
  {
    key: 'unique_key',
    title: 'Message Title',
    body: 'Message body text',
    data: { type: 'route_type', route: '/screen-name' },
  },
  // ... existing messages
];
```

### Message Guidelines
- **Title**: 40 characters or less, attention-grabbing
- **Body**: 100 characters or less, clear call to action
- **Emoji**: Use 1-2 relevant emoji at the start
- **Tone**: Friendly, encouraging, motivational
- **Data**: Include route for in-app navigation

## Rate Limiting

The system enforces strict rate limiting:
- ✅ **Maximum 1 notification per user per day**
- ✅ Checks last sent timestamp before sending
- ✅ 24-hour cooldown period
- ✅ Logs all attempts for tracking

## Performance

The system is optimized for scale:
- Processes users in batches of 50
- 1-second delay between batches to avoid rate limits
- Async processing (non-blocking)
- Efficient database queries with indexes

## Monitoring

### Server Logs
Watch for these log messages:
```
✅ Daily notification scheduler started
⏰ Daily notification time - starting broadcast...
🔔 Starting daily notification broadcast...
✅ Daily notifications complete: X sent, Y skipped, Z failed
```

### Database Tracking
Query notification logs:
```javascript
// Find today's notifications
db.notificationlogs.find({
  notificationType: 'daily_engagement',
  createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
})

// Count unique users who received notifications
db.notificationlogs.distinct('userId', {
  notificationType: 'daily_engagement'
}).length
```

## Troubleshooting

### "No users received notifications"
**Possible causes:**
1. Firebase not configured (check `FIREBASE_SERVICE_ACCOUNT_JSON`)
2. No users have registered device tokens
3. All users already received notification today (check 24h cooldown)

**Solution:**
- Verify Firebase setup in admin panel (FCM Status indicator)
- Check that frontend app is registering tokens
- Wait 24 hours or clear `NotificationLog` collection for testing

### "Scheduler not running"
**Possible causes:**
1. Server was restarted recently (scheduler starts on boot)
2. Wrong timezone configuration

**Solution:**
- Restart the backend server
- Check server logs for "Daily notification scheduler started"
- Verify `DAILY_NOTIFICATION_SCHEDULE` in `.env`

### "Messages too repetitive"
**Solution:**
- Add more messages to the pool (see "Adding New Messages")
- Current pool has 18+ messages for variety

## Best Practices

### 1. Don't Spam
- Keep to 1 notification per day max
- Monitor user uninstall/disable rates
- Use variety to prevent fatigue

### 2. Test Before Production
- Use manual trigger to test message delivery
- Verify message text and routing
- Check different device types (Android/iOS)

### 3. Monitor Engagement
- Track notification tap rates
- A/B test different message styles
- Remove messages with low engagement

### 4. Respect Users
- Never send promotional content only
- Balance educational and promotional messages
- Provide value in every notification

## Security

### Data Privacy
- No personal data in notification logs
- User IDs are hashed in logs (not exposed)
- Device tokens are stored securely

### Rate Limiting
- Built-in 24-hour cooldown per user
- Batch processing prevents server overload
- FCM rate limits respected (1000ms between batches)

## Future Enhancements

Possible improvements:
- ⭐ User preference for notification time
- ⭐ A/B testing different messages
- ⭐ Personalized messages based on user progress
- ⭐ Multi-language support
- ⭐ In-app notification history
- ⭐ Opt-out mechanism per category

## Support

For issues or questions:
1. Check admin panel stats
2. Review server logs
3. Verify Firebase setup (see `FIREBASE_SETUP.md`)
4. Test manually with trigger button
