# Push Notification Guide - Individual & Bulk Messaging

This guide explains how to send push notifications from the Admin Panel to individual users or groups.

## Features

✅ **Send to All Users** - Broadcast to everyone with the app installed  
✅ **Send to Specific Users** - Target individual users by their User IDs  
✅ **Test Mode** - Send to yourself (current admin) for testing  
✅ **Rich Notifications** - Include images and custom data  
✅ **Notification History** - Track all sent notifications  
✅ **Real-time Stats** - View delivery success rates  

---

## How to Send Individual Push Notifications

### Step 1: Find User IDs

1. Go to the **Admin Panel** → **Users** tab
2. Browse or search for the user(s) you want to message
3. Click on any **User ID** (appears as a gray code box) to copy it
4. The ID will be automatically copied to your clipboard with a green "✓ Copied!" confirmation

### Step 2: Create Push Notification

1. Go to **Admin Panel** → **Notifications** tab
2. Click **"Send Push Notification"** button
3. Fill in the form:
   - **Title**: Short, attention-grabbing title (e.g., "Welcome to Ohm's!")
   - **Message**: The main notification content
   - **Image URL** (optional): Direct URL to an image to display in the notification
   - **Target**: Select **"Specific Users"** from the dropdown
   - **User IDs**: Paste the copied user IDs (comma-separated for multiple users)
     - Example: `507f1f77bcf86cd799439011, 507f191e810c19729de860ea`
   - **Custom Data** (optional): JSON data for handling notification taps in the app
     - Example: `{"type": "course", "courseId": "123", "route": "/courses/123"}`

4. Click **"Send Now"**

### Step 3: Verify Delivery

- After sending, you'll see: *"Push notification sent successfully! Delivered to X devices."*
- Check the **Push Notification History** section below to see all sent notifications
- View **Statistics** to track:
  - Total users with notifications enabled
  - Active devices
  - Success/failure rates

---

## Target Types Explained

### 1. All Users (Broadcast)
- Sends to **every user** who has the app installed and notifications enabled
- Use for: Major announcements, app updates, promotional campaigns

### 2. Specific Users (Individual)
- Sends to **selected users only** by their User IDs
- Use for: Personal messages, subscription reminders, targeted support

### 3. Test (Current Admin)
- Sends only to **yourself** (the logged-in admin)
- Use for: Testing notification appearance before sending to real users

---

## Tips & Best Practices

### 📝 Writing Effective Notifications

- **Keep it short**: Titles under 40 characters work best
- **Be clear**: State the action or benefit immediately
- **Use action words**: "Join now", "Learn today", "Unlock premium"
- **Personalize**: Use user data when possible (requires custom integration)

### 🎯 Targeting Users

- **Don't spam**: Avoid sending too many notifications to the same user
- **Segment wisely**: Use specific targeting for relevant content
- **Test first**: Always use "Test" mode before broadcasting to all users

### 📊 Monitoring

- Check **notification stats** regularly to monitor:
  - How many users have devices registered
  - Delivery success rates
  - History of sent messages
- Failed deliveries usually mean:
  - User uninstalled the app
  - User disabled notifications
  - Device token expired

---

## Custom Data for Deep Links

You can pass custom data to notifications to control what happens when a user taps them:

```json
{
  "type": "course",
  "courseId": "675e8a9f123456789abcdef0",
  "route": "/courses/675e8a9f123456789abcdef0"
}
```

```json
{
  "type": "chat",
  "chatRoom": "general",
  "route": "/chat/general"
}
```

```json
{
  "type": "subscription",
  "plan": "advanced",
  "route": "/subscription"
}
```

The app can read this data and navigate to the appropriate screen when the notification is tapped.

---

## Automated Daily Notifications

The system also sends **automatic daily engagement notifications** to all users once per day:

- **Schedule**: 10:00 AM IST (configurable via `DAILY_NOTIFICATION_SCHEDULE` in `.env`)
- **Smart Rate Limiting**: Each user receives only 1 automated notification per day
- **Diverse Messages**: Random selection from a pool of 30+ engaging messages
- **Categories**: 
  - Learning encouragement
  - Subscription benefits
  - Meeting new people
  - Chat practice
  - Progress motivation

**View Daily Config**: Go to **Notifications** tab → **Daily Notifications** section to:
- See the current schedule
- View the message pool (30+ unique messages)
- Check stats (last sent, total sent today, eligible users)
- Manually trigger daily notifications (for testing)

---

## Troubleshooting

### "No devices to send to"
- The user(s) haven't registered for push notifications yet
- They need to open the app and grant notification permissions

### "Failed to send notification"
- Check Firebase configuration in backend `.env`:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_PRIVATE_KEY_ID`
- Verify Firebase project has FCM enabled

### Notification not appearing on device
- Check if the user has notifications enabled in device settings
- Verify the app is properly configured with `google-services.json` (Android) or APNs (iOS)
- Test with "Test" mode first to isolate issues

### Can't find User ID
- Make sure you're on the **Users** tab (not Subscriptions or other tabs)
- Use the search bar to find users by name, email, or phone
- User IDs are displayed in the third column

---

## API Endpoints (for developers)

If you want to send notifications programmatically from your own scripts:

```javascript
// Register device token (from mobile app)
POST /api/app/device-token
Body: { token: "expo-push-token-here", platform: "ios", model: "iPhone 14" }

// Send notification (admin only)
POST /api/admin/push-notifications/send
Body: {
  title: "Hello!",
  body: "This is a test notification",
  targetType: "specific",
  targetUserIds: ["user_id_1", "user_id_2"]
}

// Get notification history
GET /api/admin/push-notifications/history?limit=20&skip=0

// Get stats
GET /api/admin/push-notifications/stats
```

---

## Security Notes

🔒 **Admin Access Only**
- Only authenticated admins can send push notifications
- The `/api/admin/*` endpoints require admin JWT tokens

🔒 **Firebase Service Account**
- Service account credentials are stored securely in environment variables
- Never commit `serviceAccountKey.json` or private keys to Git
- Use split environment variables in production (Render, Heroku, etc.)

🔒 **Device Token Management**
- Tokens are automatically cleaned up when users uninstall the app
- Expired tokens are marked as inactive
- Users can unregister tokens via the app

---

## Examples

### Example 1: Welcome New User
```
Title: Welcome to Ohm's English! 🎉
Message: Start your English learning journey today. Explore courses and meet new people!
Target: Specific Users
User IDs: 507f1f77bcf86cd799439011
Custom Data: {"type": "welcome", "route": "/courses"}
```

### Example 2: Subscription Reminder
```
Title: Unlock Premium Features! 💎
Message: Upgrade to Advanced plan and get access to all courses and live practice sessions.
Target: Specific Users
User IDs: (multiple IDs of free users)
Custom Data: {"type": "subscription", "plan": "advanced", "route": "/subscription"}
```

### Example 3: New Course Launch
```
Title: New Course: Business English 🚀
Message: Master professional English for the workplace. Enroll now!
Target: All Users
Image URL: https://yourserver.com/uploads/courses/business-english-banner.jpg
Custom Data: {"type": "course", "courseId": "123", "route": "/courses/123"}
```

### Example 4: Testing Before Broadcasting
```
Title: Test - Weekend Offer
Message: This weekend only: 50% off all subscriptions!
Target: Test (Current Admin)
(Preview how the notification looks before sending to everyone)
```

---

## Support

For technical issues or questions:
- Check the **console logs** in the backend server
- Review `FIREBASE_SETUP.md` for Firebase configuration
- Review `DAILY_NOTIFICATIONS.md` for automated notification details
- Check the Admin Panel **Statistics** section for delivery insights

---

**Last Updated**: August 15, 2026  
**Version**: 1.0
