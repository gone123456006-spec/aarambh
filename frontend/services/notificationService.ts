import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { apiFetch } from '@/utils/api';

const FCM_TOKEN_KEY = '@fcm_token';
const EXPO_PROJECT_ID = '7ff2aadf-dae7-4b7c-9024-1bd25662363e';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function isProductionApp(): boolean {
  // Installed APK / Play build / dev-client — not Expo Go
  return !isExpoGo();
}

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
 * Native FCM (Android) / APNs (iOS) token for production installs.
 */
export async function getNativePushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof deviceToken?.data === 'string' ? deviceToken.data : null;
    if (token && token.length > 20 && !token.startsWith('ExponentPushToken[')) {
      console.log('[push] Native device token acquired', token.slice(0, 24) + '…');
      return token;
    }
    return null;
  } catch (error) {
    console.warn('[push] Native FCM/APNs token unavailable:', error);
    return null;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      EXPO_PROJECT_ID;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.error('[push] Expo push token error:', error);
    return null;
  }
}

export type PushTokenEntry = {
  token: string;
  tokenType: 'fcm' | 'expo';
};

/**
 * Production APK/AAB must use native FCM. Expo Go uses Expo push tokens.
 */
export async function getPushTokenEntries(): Promise<PushTokenEntry[]> {
  const entries: PushTokenEntry[] = [];

  if (isExpoGo()) {
    const expoToken = await getExpoPushToken();
    if (expoToken) entries.push({ token: expoToken, tokenType: 'expo' });
    return entries;
  }

  // Prefer native FCM/APNs for installed production apps
  let nativeToken: string | null = null;
  for (let attempt = 0; attempt < 3 && !nativeToken; attempt += 1) {
    nativeToken = await getNativePushToken();
    if (!nativeToken) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  if (nativeToken) {
    entries.push({ token: nativeToken, tokenType: 'fcm' });
  } else {
    console.warn(
      '[push] Production build has no native FCM token. Ensure google-services.json is in the APK and rebuild.'
    );
  }

  // Optional Expo token as secondary only (does not replace FCM for production delivery)
  if (Platform.OS === 'ios') {
    const expoToken = await getExpoPushToken();
    if (expoToken && expoToken !== nativeToken) {
      entries.push({ token: expoToken, tokenType: 'expo' });
    }
  }

  return entries;
}

export async function getPushTokens(): Promise<string[]> {
  const entries = await getPushTokenEntries();
  return entries.map((e) => e.token);
}

export async function getPushToken(): Promise<string | null> {
  const tokens = await getPushTokens();
  return tokens[0] || null;
}

export async function registerDeviceToken(
  token: string,
  tokenType: 'fcm' | 'expo' = 'fcm'
): Promise<boolean> {
  try {
    const deviceInfo = {
      platform: Platform.OS,
      model: Device.modelName || undefined,
      osVersion: Device.osVersion || undefined,
      tokenType,
      appOwnership: Constants.appOwnership || undefined,
      executionEnvironment: Constants.executionEnvironment || undefined,
    };

    await apiFetch('/api/app/device-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...deviceInfo }),
    });

    // Prefer keeping FCM in local storage for diagnostics
    const existing = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    if (tokenType === 'fcm' || !existing || existing.startsWith('ExponentPushToken[')) {
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    }

    console.log(`✅ Device token registered (${tokenType})`);
    return true;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  try {
    await apiFetch('/api/app/device-token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to unregister device token:', error);
  }
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function initializePushNotifications(): Promise<boolean> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return false;

    const entries = await getPushTokenEntries();
    if (!entries.length) {
      console.warn('[push] No push tokens available for this build');
      return false;
    }

    let registeredAny = false;
    for (const entry of entries) {
      const registered = await registerDeviceToken(entry.token, entry.tokenType);
      if (registered) registeredAny = true;
    }

    if (isProductionApp() && Platform.OS === 'android') {
      const hasFcm = entries.some((e) => e.tokenType === 'fcm');
      if (!hasFcm) {
        console.warn('[push] Production Android registered without FCM — rebuild APK with google-services.json');
      }
    }

    return registeredAny;
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    return false;
  }
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function sendTestNotification(): Promise<void> {
  try {
    await apiFetch('/api/app/test-notification', {
      method: 'POST',
    });
  } catch (error) {
    console.error('Failed to send test notification:', error);
  }
}

/** Re-register when app returns to foreground (token rotation / login race). */
export function startPushTokenRefreshOnForeground(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void initializePushNotifications();
    }
  });
  return () => sub.remove();
}
