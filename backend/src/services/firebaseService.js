const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, cert: createCert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const DeviceToken = require('../models/DeviceToken');
const Notification = require('../models/Notification');
const InAppNotification = require('../models/InAppNotification');
const User = require('../models/User');

let firebaseApp = null;

const BACKEND_ROOT = path.join(__dirname, '../..');
const SEALED_SA_PATH = path.join(__dirname, '../config/firebaseSa.sealed');
const SEAL_PASS_PREFIX = 'ohms-fcm-seal-v1:';

function stripWrappingQuotes(value) {
  let key = String(value || '').trim();
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

function stripEnvKeyPrefix(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^FIREBASE_PRIVATE_KEY\s*=\s*/i, '')
    .trim();
}

function decodeBase64Text(value) {
  if (!value) return '';
  try {
    return Buffer.from(String(value).replace(/\s/g, ''), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function canonicalizePrivateKeyPem(pem) {
  if (!pem) return null;
  try {
    const keyObject = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return keyObject.export({ type: 'pkcs8', format: 'pem' });
  } catch {
    return null;
  }
}

function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = stripEnvKeyPrefix(stripWrappingQuotes(raw));

  if (!key.includes('BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(key) && key.length > 200) {
    const decoded = decodeBase64Text(key);
    if (decoded.includes('BEGIN')) {
      key = decoded;
    }
  }

  for (let i = 0; i < 4; i += 1) {
    if (!key.includes('\\n') && !key.includes('\\r')) break;
    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  }

  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (key.includes('BEGIN') && !key.includes('\n')) {
    key = key
      .replace(/-----BEGIN ([A-Z ]+)-----/, '-----BEGIN $1-----\n')
      .replace(/-----END ([A-Z ]+)-----/, '\n-----END $1-----');
  }

  const pem = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (pem) {
    const type = pem[1];
    const body = pem[2].replace(/[^A-Za-z0-9+/=]/g, '');
    if (body) {
      const lines = body.match(/.{1,64}/g) || [];
      key = `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`;
    }
  } else if (key.includes('BEGIN') && !key.endsWith('\n')) {
    key += '\n';
  }

  return canonicalizePrivateKeyPem(key) || key;
}

function describePrivateKeyState(privateKey) {
  const key = String(privateKey || '');
  return {
    length: key.length,
    hasBegin: key.includes('BEGIN PRIVATE KEY'),
    hasEnd: key.includes('END PRIVATE KEY'),
    newlineCount: (key.match(/\n/g) || []).length,
  };
}

function loadServiceAccountFromSplitEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID?.trim();

  if (!projectId || !clientEmail || !privateKey.includes('BEGIN')) {
    return null;
  }

  const credentials = {
    type: 'service_account',
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
    _source: 'split-env',
  };

  if (privateKeyId) credentials.private_key_id = privateKeyId;
  return credentials;
}

function loadServiceAccountFromBase64KeyEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID?.trim();
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64?.trim();
  if (!projectId || !clientEmail || !b64) return null;

  const privateKey = normalizePrivateKey(decodeBase64Text(b64));
  if (!privateKey.includes('BEGIN')) return null;

  const credentials = {
    type: 'service_account',
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
    _source: 'private-key-b64',
  };
  if (privateKeyId) credentials.private_key_id = privateKeyId;
  return credentials;
}

function loadServiceAccountFromFile() {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!filePath) return null;

  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(BACKEND_ROOT, filePath);
  if (!fs.existsSync(resolved)) return null;

  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (parsed.private_key) {
    parsed.private_key = normalizePrivateKey(parsed.private_key);
  }
  parsed._source = 'file';
  return parsed;
}

function loadServiceAccountFromJsonEnv() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(stripWrappingQuotes(rawJson));
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    parsed._source = 'service-account-json';
    return parsed;
  } catch (error) {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_JSON parse failed:', error.message);
    return null;
  }
}

function loadServiceAccountFromJsonB64Env() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();
  if (!b64) return null;
  try {
    const parsed = JSON.parse(decodeBase64Text(b64));
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    parsed._source = 'service-account-b64';
    return parsed;
  } catch (error) {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_B64 parse failed:', error.message);
    return null;
  }
}

/**
 * Sealed service account shipped with the backend so Render does not depend on
 * a mangled FIREBASE_PRIVATE_KEY env value (root cause of "Failed to parse private key").
 */
function loadServiceAccountFromSealed() {
  if (!fs.existsSync(SEALED_SA_PATH)) return null;
  try {
    const payload = fs.readFileSync(SEALED_SA_PATH, 'utf8').trim();
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);

    const tryDecrypt = (pass) => {
      const key = crypto.createHash('sha256').update(pass).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    };

    let jsonText = null;
    const passes = [
      `${SEAL_PASS_PREFIX}ohms-english-learning`,
      process.env.FIREBASE_PROJECT_ID
        ? `${SEAL_PASS_PREFIX}${process.env.FIREBASE_PROJECT_ID.trim()}`
        : null,
    ].filter(Boolean);

    for (const pass of passes) {
      try {
        jsonText = tryDecrypt(pass);
        break;
      } catch {
        // try next passphrase
      }
    }
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText);
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    parsed._source = 'sealed-bundle';
    return parsed;
  } catch (error) {
    console.warn('⚠️  Sealed Firebase credentials failed:', error.message);
    return null;
  }
}

function isUsableServiceAccount(credentials) {
  if (!credentials?.project_id || !credentials?.client_email || !credentials?.private_key) {
    return false;
  }
  try {
    crypto.createPrivateKey({ key: credentials.private_key, format: 'pem' });
    return true;
  } catch {
    return false;
  }
}

function loadServiceAccountCandidates() {
  return [
    loadServiceAccountFromSealed(),
    loadServiceAccountFromJsonB64Env(),
    loadServiceAccountFromJsonEnv(),
    loadServiceAccountFromFile(),
    loadServiceAccountFromSplitEnv(),
    loadServiceAccountFromBase64KeyEnv(),
  ].filter((c) => c && isUsableServiceAccount(c));
}

function createFirebaseCredential(credentials) {
  if (typeof createCert !== 'function') {
    throw new Error('firebase-admin cert() is not available');
  }
  return createCert(credentials);
}

/**
 * Initialize Firebase Admin SDK.
 * Call this once at server startup.
 */
function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existing = getApps();
  if (existing.length) {
    firebaseApp = existing[0];
    console.log('✅ Firebase Admin already initialized');
    return firebaseApp;
  }

  const candidates = loadServiceAccountCandidates();
  if (!candidates.length) {
    console.warn('⚠️  Firebase service account not configured. Push notifications will be disabled.');
    return null;
  }

  let lastError = null;
  for (const credentials of candidates) {
    const source = credentials._source || 'unknown';
    const { _source, ...firebaseCredentials } = credentials;
    try {
      firebaseApp = initializeApp({
        credential: createFirebaseCredential(firebaseCredentials),
        projectId: firebaseCredentials.project_id,
      });
      console.log(`✅ Firebase Admin initialized successfully (${source})`);
      return firebaseApp;
    } catch (error) {
      lastError = error;
      const keyState = describePrivateKeyState(firebaseCredentials.private_key);
      console.warn(
        `⚠️  Firebase credential candidate failed (${source}):`,
        error.message,
        JSON.stringify(keyState)
      );
    }
  }

  console.error('❌ Failed to initialize Firebase Admin:', lastError?.message || 'Unknown error');
  return null;
}

/**
 * Check if Firebase is properly initialized.
 */
function isFirebaseEnabled() {
  return firebaseApp !== null;
}

function isExpoPushToken(token) {
  return typeof token === 'string' && /^ExponentPushToken\[.+\]$/.test(token);
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

async function fetchExpoReceipts(ticketIds) {
  if (!ticketIds.length) return {};
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });
    const json = await res.json();
    return json.data || {};
  } catch (error) {
    console.warn('Expo receipt check failed:', error.message);
    return {};
  }
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
    ttl: 86400,
    badge: 1,
    ...(notification.imageUrl ? { richContent: { image: notification.imageUrl } } : {}),
  }));

  let successCount = 0;
  let failureCount = 0;
  const failedTokens = [];
  const ticketIds = [];
  const ticketTokenMap = {};

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
        const token = chunk[idx].to;
        if (ticket?.status === 'ok' && ticket.id) {
          ticketIds.push(ticket.id);
          ticketTokenMap[ticket.id] = token;
          successCount += 1;
        } else {
          failureCount += 1;
          failedTokens.push(token);
          console.warn('Expo push failed:', ticket?.message || ticket?.details?.error);
        }
      });
      if (!tickets.length && !res.ok) {
        failureCount += chunk.length;
        failedTokens.push(...chunk.map((m) => m.to));
      }
    }

    if (ticketIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const receipts = await fetchExpoReceipts(ticketIds);
      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt?.status === 'ok') continue;
        const token = ticketTokenMap[id];
        if (token) failedTokens.push(token);
        successCount = Math.max(0, successCount - 1);
        failureCount += 1;
        console.warn(
          'Expo delivery failed:',
          receipt?.message || receipt?.details?.error || receipt?.status
        );
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

  return { successCount, failureCount, failedTokens: [...new Set(failedTokens)] };
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
        defaultVibrateTimings: true,
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

  const response = await getMessaging(firebaseApp).sendEachForMulticast(message);
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

async function sendToAll(notification, data = {}) {
  const BATCH_SIZE = 500;
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

    if (deviceTokens.length === BATCH_SIZE) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else {
      hasMore = false;
    }
  }

  return { successCount: totalSuccess, failureCount: totalFailure };
}

async function fanoutInAppNotifications({ title, body, data = {}, targetType = 'all', targetUserIds = [] }) {
  try {
    let userIds = Array.isArray(targetUserIds) ? targetUserIds.filter(Boolean) : [];
    if (targetType === 'all') {
      userIds = await User.find({ role: { $ne: 'admin' } }).distinct('_id');
    }
    if (!userIds.length) return 0;

    const allowedTypes = ['system', 'welcome', 'reward', 'course', 'game', 'points', 'leaderboard', 'subscription', 'chat', 'call', 'achievement'];
    const docs = userIds.map((userId) => ({
      user: userId,
      title,
      message: body,
      type: allowedTypes.includes(data.type) ? data.type : 'system',
      data: Object.keys(data).length ? data : null,
    }));

    for (let i = 0; i < docs.length; i += 500) {
      await InAppNotification.insertMany(docs.slice(i, i + 500), { ordered: false });
    }
    return docs.length;
  } catch (error) {
    console.warn('In-app notification fanout failed:', error.message);
    return 0;
  }
}

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
    let result = { successCount: 0, failureCount: 0 };

    try {
      if (targetType === 'specific' && targetUserIds.length > 0) {
        result = await sendToUsers(targetUserIds, { title, body, imageUrl }, data);
      } else if (targetType === 'all') {
        result = await sendToAll({ title, body, imageUrl }, data);
      }
    } catch (pushError) {
      console.warn('Push send failed, continuing with in-app fanout:', pushError.message);
    }

    const inAppCount = await fanoutInAppNotifications({
      title,
      body,
      data,
      targetType,
      targetUserIds,
    });

    notification.totalSent = result.successCount + result.failureCount;
    notification.successCount = result.successCount;
    notification.failureCount = result.failureCount;
    notification.status = result.successCount > 0 || inAppCount > 0 ? 'sent' : 'failed';
    await notification.save();

    return { notification, result };
  } catch (error) {
    notification.status = 'failed';
    await notification.save();
    throw error;
  }
}

async function registerToken(userId, token, deviceInfo = {}) {
  if (!token) {
    throw new Error('Token is required');
  }

  let deviceToken = await DeviceToken.findOne({ token });

  if (deviceToken) {
    deviceToken.userId = userId;
    deviceToken.deviceInfo = deviceInfo;
    deviceToken.isActive = true;
    deviceToken.lastUsedAt = new Date();
  } else {
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

async function unregisterToken(token) {
  if (!token) return;
  await DeviceToken.updateOne({ token }, { $set: { isActive: false } });
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
  normalizePrivateKey,
  fanoutInAppNotifications,
};
