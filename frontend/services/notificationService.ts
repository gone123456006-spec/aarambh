import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { apiFetch } from '@/utils/api';

const FCM_TOKEN_KEY = '@fcm_token';

/**
 * Configure how notifications are handled when the app is in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from the user.
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permission denied');
      return false;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e60000',
        sound: 'default',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get a native FCM token on Android production builds.
 * Expo push tokens often show "ok" without reaching Play Store / local AAB installs.
 */
export async function getNativePushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof deviceToken?.data === 'string' ? deviceToken.data : null;
    if (token && token.length > 20 && !token.startsWith('ExponentPushToken[')) {
      return token;
    }
    return null;
  } catch (error) {
    console.warn('Native FCM token unavailable, will use Expo token:', error);
    return null;
  }
}

/**
 * Get the Expo push token for this device.
 * @returns {Promise<string | null>} - The push token or null if failed
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '7ff2aadf-dae7-4b7c-9024-1bd25662363e',
    });

    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

export async function getPushTokens(): Promise<string[]> {
  const tokens: string[] = [];
  const isExpoGo = Constants.appOwnership === 'expo';

  if (isExpoGo) {
    const expoToken = await getExpoPushToken();
    if (expoToken) tokens.push(expoToken);
    return tokens;
  }

  const nativeToken = await getNativePushToken();
  if (nativeToken) tokens.push(nativeToken);

  const expoToken = await getExpoPushToken();
  if (expoToken && expoToken !== nativeToken) tokens.push(expoToken);

  return tokens;
}

export async function getPushToken(): Promise<string | null> {
  const tokens = await getPushTokens();
  return tokens[0] || null;
}

/**
 * Register the device token with the backend.
 * @param {string} token - The FCM/Expo push token
 * @returns {Promise<boolean>} - True if registration successful
 */
export async function registerDeviceToken(token: string): Promise<boolean> {
  try {
    const deviceInfo = {
      platform: Platform.OS,
      model: Device.modelName || undefined,
      osVersion: Device.osVersion || undefined,
    };

    await apiFetch('/api/app/device-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...deviceInfo }),
    });

    // Save token locally
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);

    console.log('✅ Device token registered successfully');
    return true;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
}

/**
 * Unregister the device token from the backend.
 * @param {string} token - The FCM/Expo push token
 */
export async function unregisterDeviceToken(token: string): Promise<void> {
  try {
    await apiFetch('/api/app/device-token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
    console.log('Device token unregistered');
  } catch (error) {
    console.error('Failed to unregister device token:', error);
  }
}

/**
 * Get the locally stored FCM token.
 * @returns {Promise<string | null>}
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Initialize push notifications.
 * Requests permissions, gets token, and registers with backend.
 * @returns {Promise<boolean>} - True if initialization successful
 */
export async function initializePushNotifications(): Promise<boolean> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    const tokens = await getPushTokens();
    if (!tokens.length) {
      return false;
    }

    let registeredAny = false;
    for (const token of tokens) {
      const registered = await registerDeviceToken(token);
      if (registered) registeredAny = true;
    }
    return registeredAny;
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    return false;
  }
}

/**
 * Add a notification received listener.
 * Called when a notification is received while the app is in the foreground.
 * @param {Function} callback - Callback function
 * @returns {Subscription} - Subscription object to remove the listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a notification response listener.
 * Called when the user taps on a notification.
 * @param {Function} callback - Callback function
 * @returns {Subscription} - Subscription object to remove the listener
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Send a test notification to the current user.
 */
export async function sendTestNotification(): Promise<void> {
  try {
    await apiFetch('/api/app/test-notification', {
      method: 'POST',
    });
    console.log('Test notification sent');
  } catch (error) {
    console.error('Failed to send test notification:', error);
  }
}
