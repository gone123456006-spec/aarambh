# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you configure push notifications for the Ohm's English Learning app using Firebase Cloud Messaging.

## Prerequisites

- A Firebase account
- Access to the Firebase Console
- Admin access to the project

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

## Step 2: Add Android App to Firebase Project

1. In the Firebase Console, click the gear icon next to "Project Overview" and select "Project settings"
2. Scroll down to "Your apps" section
3. Click the Android icon to add an Android app
4. Enter your package name: `com.ohms.english` (must match the package in app.json)
5. Download the `google-services.json` file
6. Place `google-services.json` in the frontend root directory: `d:\aarambh\frontend\google-services.json`

## Step 3: Generate Service Account Key

1. In Firebase Console, go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file (e.g., `aarambh-firebase-adminsdk.json`)
4. **IMPORTANT**: Keep this file secure and never commit it to version control

## Step 4: Configure Backend Environment Variables

1. Open the downloaded service account JSON file
2. Copy the entire JSON content (it should be a single object with fields like `type`, `project_id`, `private_key`, etc.)
3. Remove all line breaks to make it a single line
4. Add to `d:\aarambh\backend\.env`:

```env
# Firebase Cloud Messaging (Push Notifications)
# Paste the entire service account JSON as a single line
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id",...}
```

**Example of formatting the JSON:**

Original (multi-line):
```json
{
  "type": "service_account",
  "project_id": "ohms-english",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  ...
}
```

Formatted (single line):
```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ohms-english","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",...}
```

## Step 5: Enable Cloud Messaging API

1. In Firebase Console, go to Cloud Messaging
2. Ensure the Firebase Cloud Messaging API is enabled
3. If prompted, enable it

## Step 6: Restart the Backend

After adding the `FIREBASE_SERVICE_ACCOUNT_JSON` to your `.env` file:

```bash
cd d:\aarambh\backend
npm start
```

You should see: `✅ Firebase Admin initialized successfully`

If you see: `⚠️  Firebase service account not configured. Push notifications will be disabled.`
- Double-check that `FIREBASE_SERVICE_ACCOUNT_JSON` is set in `.env`
- Ensure the JSON is valid (no syntax errors)
- Restart the backend server

## Step 7: Rebuild the Frontend App

The frontend needs to be rebuilt to include the `google-services.json` file:

```bash
cd d:\aarambh\frontend
# For development
npm run start

# For production build
npm run android:release
# or
npm run build:aab
```

## Step 8: Test Push Notifications

### Option 1: From Admin Panel

1. Log in to the admin panel: `http://localhost:5000/admin`
2. Go to the "Notifications" tab
3. Click "Send Push Notification"
4. Fill in the form:
   - Title: "Test Notification"
   - Message: "This is a test push notification!"
   - Target: "Test (Current Admin)" or "All Users"
5. Click "Send Now"

### Option 2: From Backend API

Use the test endpoint (requires authentication):

```bash
curl -X POST http://localhost:5000/api/app/test-notification \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Troubleshooting

### "Push notifications not configured"

**Solution**: Ensure `FIREBASE_SERVICE_ACCOUNT_JSON` is set in `.env` and the backend is restarted.

### "No active device tokens found"

**Solution**: 
- Ensure the frontend app is running on a physical device (not emulator)
- Check that notification permissions are granted in the app
- Verify that the device token is being registered by checking the logs

### Notifications not appearing on device

**Possible causes**:
1. App doesn't have notification permissions
2. Device is in Do Not Disturb mode
3. Google Play Services not installed/updated
4. `google-services.json` not included in the build

**Solutions**:
- Go to device Settings → Apps → Ohm's English → Permissions → Notifications → Enable
- Rebuild the app with `google-services.json` in the frontend root directory
- Ensure Google Play Services is installed and updated

### "Invalid registration token"

**Solution**: The device token has expired or is invalid. The app will automatically refresh the token. Try uninstalling and reinstalling the app.

## Security Best Practices

1. **Never commit** `google-services.json` or the service account JSON to version control
2. Add to `.gitignore`:
   ```
   google-services.json
   *-firebase-adminsdk-*.json
   ```
3. Keep the service account JSON secure - it has full access to your Firebase project
4. Rotate service account keys periodically from Firebase Console
5. Use environment-specific Firebase projects (dev, staging, production)

## Features Implemented

### Backend
- ✅ Firebase Admin SDK integration
- ✅ Device token management (register/unregister)
- ✅ Push notification API endpoints
- ✅ Notification history and stats
- ✅ Automatic notifications for:
  - New courses added
  - New lessons added
  - Welcome message for new users
  - Subscription events

### Frontend
- ✅ Expo Notifications integration
- ✅ Permission handling
- ✅ Device token registration
- ✅ Foreground notification display
- ✅ Background notification handling
- ✅ Notification tap handling with custom data

### Admin Panel
- ✅ Push notification composer
- ✅ Target specific users or broadcast to all
- ✅ Notification history viewer
- ✅ Real-time statistics (active devices, users with notifications, total sent)
- ✅ FCM status indicator

## Production Deployment

### Backend
1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` in production environment
2. Ensure proper SSL/TLS for API endpoints
3. Set up monitoring for failed notifications

### Frontend
1. Use production Firebase project
2. Use release signing key for Android builds
3. Upload signed APK/AAB to Google Play Store
4. Test notifications on production builds before release

## Support

For issues with Firebase setup, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
