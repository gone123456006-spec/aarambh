const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');

let firebaseApp = null;

const BACKEND_ROOT = path.join(__dirname, '../..');

function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  // Remove surrounding quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Replace literal \n with actual newlines (handles both \\n and \n)
  // First try double-escaped (from JSON string)
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  return key;
}

function loadServiceAccountFromSplitEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID?.trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  const credentials = {
    type: 'service_account',
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };

  if (privateKeyId) credentials.private_key_id = privateKeyId;
  return credentials;
}

function loadServiceAccount() {
  const fromSplit = loadServiceAccountFromSplitEnv();
  if (fromSplit) return fromSplit;

  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BACKEND_ROOT, filePath);
    if (fs.existsSync(resolved)) {
      return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    }
  }

  if (rawJson) {
    return JSON.parse(rawJson);
  }

  return null;
}

/**
 * Initialize Firebase Admin SDK.
 * Call this once at server startup.
 */
function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    const credentials = loadServiceAccount();

    if (!credentials) {
      console.warn('⚠️  Firebase service account not configured. Push notifications will be disabled.');
      return null;
    }

    firebaseApp = admin.initializeApp({
      credential: admin.cert(credentials),
    });

    console.log('✅ Firebase Admin initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    return null;
  }
}

/**
 * Check if Firebase is properly initialized.
 */
function isFirebaseEnabled() {
  return firebaseApp !== null;
}

function isExpoPushToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

function stringifyData(data = {}) {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  out.timestamp = Date.now().toString();
  return out;
}

async function sendViaExpo(tokens, notification, data = {}) {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, failedTokens: [] };
  }

  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: stringifyData(data),
    channelId: 'default',
    priority: 'high',
    ...(notification.imageUrl ? { richContent: { image: notification.imageUrl } } : {}),
  }));

  let successCount = 0;
  let failureCount = 0;
  const failedTokens = [];

  try {
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json();
      const tickets = Array.isArray(json.data) ? json.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === 'ok') {
          successCount += 1;
        } else {
          failureCount += 1;
          failedTokens.push(chunk[idx].to);
          console.warn('Expo push failed:', ticket?.message || ticket?.details?.error);
        }
      });
      if (!tickets.length && !res.ok) {
        failureCount += chunk.length;
        failedTokens.push(...chunk.map((m) => m.to));
      }
    }
  } catch (error) {
    console.error('Expo push send failed:', error.message);
    return {
      successCount,
      failureCount: failureCount + tokens.length - successCount,
      failedTokens: [...failedTokens, ...tokens],
    };
  }

  return { successCount, failureCount, failedTokens };
}

async function sendViaFcm(tokens, notification, data = {}) {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, failedTokens: [] };
  }
  if (!isFirebaseEnabled()) {
    console.warn('Firebase not enabled, skipping FCM send');
    return { successCount: 0, failureCount: tokens.length, failedTokens: tokens };
  }

  const message = {
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: stringifyData(data),
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  if (notification.imageUrl) {
    message.notification.imageUrl = notification.imageUrl;
    message.android.notification.imageUrl = notification.imageUrl;
    message.apns.payload.aps.mutableContent = 1;
    message.apns.fcmOptions = { imageUrl: notification.imageUrl };
  }

  const response = await admin.messaging().sendEachForMulticast(message);
  const failedTokens = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      failedTokens.push(tokens[idx]);
      console.warn(`Failed to send FCM token ${idx}:`, resp.error?.message);
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    failedTokens,
  };
}

/**
 * Send push notification to Expo and/or FCM device tokens.
 */
async function sendToTokens(tokens, notification, data = {}) {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, failedTokens: [] };
  }

  const expoTokens = tokens.filter(isExpoPushToken);
  const fcmTokens = tokens.filter((token) => !isExpoPushToken(token));
  const failedTokens = [];
  let successCount = 0;
  let failureCount = 0;

  try {
    if (expoTokens.length) {
      const expoResult = await sendViaExpo(expoTokens, notification, data);
      successCount += expoResult.successCount;
      failureCount += expoResult.failureCount;
      failedTokens.push(...expoResult.failedTokens);
    }

    if (fcmTokens.length) {
      const fcmResult = await sendViaFcm(fcmTokens, notification, data);
      successCount += fcmResult.successCount;
      failureCount += fcmResult.failureCount;
      failedTokens.push(...fcmResult.failedTokens);
    }

    if (failedTokens.length > 0) {
      await DeviceToken.updateMany(
        { token: { $in: failedTokens }, isActive: true },
        { $set: { isActive: false } }
      );
    }

    return { successCount, failureCount, failedTokens };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { successCount: 0, failureCount: tokens.length, failedTokens: tokens };
  }
}

/**
 * Send notification to specific users.
 * @param {string[]} userIds - Array of user IDs
 * @param {Object} notification - { title, body, imageUrl? }
 * @param {Object} data - Custom data payload
 */
async function sendToUsers(userIds, notification, data = {}) {
  const deviceTokens = await DeviceToken.find({
    userId: { $in: userIds },
    isActive: true,
  });

  if (deviceTokens.length === 0) {
    console.log('No active device tokens found for specified users');
    return { successCount: 0, failureCount: 0 };
  }

  const tokens = deviceTokens.map((dt) => dt.token);
  return sendToTokens(tokens, notification, data);
}

/**
 * Send notification to all users (broadcast).
 * @param {Object} notification - { title, body, imageUrl? }
 * @param {Object} data - Custom data payload
 */
async function sendToAll(notification, data = {}) {
  const BATCH_SIZE = 500; // FCM limit is 500 tokens per request
  let totalSuccess = 0;
  let totalFailure = 0;

  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const deviceTokens = await DeviceToken.find({ isActive: true })
      .limit(BATCH_SIZE)
      .skip(skip);

    if (deviceTokens.length === 0) {
      hasMore = false;
      break;
    }

    const tokens = deviceTokens.map((dt) => dt.token);
    const result = await sendToTokens(tokens, notification, data);

    totalSuccess += result.successCount;
    totalFailure += result.failureCount;

    skip += BATCH_SIZE;
    
    // Small delay between batches to avoid rate limiting
    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { successCount: totalSuccess, failureCount: totalFailure };
}

/**
 * Save a notification record and send it.
 * @param {Object} params - { title, body, imageUrl?, data?, targetType, targetUserIds?, sentBy? }
 */
async function createAndSendNotification(params) {
  const {
    title,
    body,
    imageUrl,
    data = {},
    targetType = 'all',
    targetUserIds = [],
    sentBy,
  } = params;

  // Create notification record
  const notification = new Notification({
    title,
    body,
    imageUrl,
    data,
    targetType,
    targetUserIds,
    sentBy,
    status: 'sending',
  });

  await notification.save();

  try {
    let result;
    
    if (targetType === 'specific' && targetUserIds.length > 0) {
      result = await sendToUsers(targetUserIds, { title, body, imageUrl }, data);
    } else if (targetType === 'all') {
      result = await sendToAll({ title, body, imageUrl }, data);
    } else {
      result = { successCount: 0, failureCount: 0 };
    }

    // Update notification record
    notification.totalSent = result.successCount + result.failureCount;
    notification.successCount = result.successCount;
    notification.failureCount = result.failureCount;
    notification.status = result.successCount > 0 ? 'sent' : 'failed';
    await notification.save();

    return { notification, result };
  } catch (error) {
    notification.status = 'failed';
    await notification.save();
    throw error;
  }
}

/**
 * Register a device token for a user.
 * @param {string} userId - User ID
 * @param {string} token - FCM token
 * @param {Object} deviceInfo - { platform, model, osVersion }
 */
async function registerToken(userId, token, deviceInfo = {}) {
  if (!token) {
    throw new Error('Token is required');
  }

  // Check if token already exists
  let deviceToken = await DeviceToken.findOne({ token });

  if (deviceToken) {
    // Update existing token
    deviceToken.userId = userId;
    deviceToken.deviceInfo = deviceInfo;
    deviceToken.isActive = true;
    deviceToken.lastUsedAt = new Date();
  } else {
    // Create new token
    deviceToken = new DeviceToken({
      userId,
      token,
      deviceInfo,
      isActive: true,
      lastUsedAt: new Date(),
    });
  }

  await deviceToken.save();
  return deviceToken;
}

/**
 * Unregister a device token.
 * @param {string} token - FCM token to remove
 */
async function unregisterToken(token) {
  if (!token) {
    return;
  }

  await DeviceToken.updateOne(
    { token },
    { $set: { isActive: false } }
  );
}

module.exports = {
  initializeFirebase,
  isFirebaseEnabled,
  sendToTokens,
  sendToUsers,
  sendToAll,
  createAndSendNotification,
  registerToken,
  unregisterToken,
};
