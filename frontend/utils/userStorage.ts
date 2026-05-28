import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';

const USER_DATA_BASE_KEYS = [
  'completedLessons',
  'lastLessonId',
  'gameProgress',
  'gameStats',
  'userName',
  'userRegion',
  'gender',
  'level',
  'userPhone',
  'userEmail',
];

export async function getCurrentUserId(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_KEYS.userId);
}

/** Storage key isolated per authenticated MongoDB user */
export async function userScopedKey(baseKey: string): Promise<string> {
  const userId = await getCurrentUserId();
  return userId ? `${baseKey}@${userId}` : baseKey;
}

function shouldRemoveKey(key: string, authKeySet: Set<string>): boolean {
  if (authKeySet.has(key)) return true;
  if (key.startsWith('leaderboard:')) return true;
  return USER_DATA_BASE_KEYS.some(
    (base) => key === base || key.startsWith(`${base}@`)
  );
}

/**
 * Remove all session tokens and user-specific cached data from this device.
 */
export async function clearAllLocalUserData(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const authKeySet = new Set<string>(Object.values(AUTH_KEYS));
  const toRemove = allKeys.filter((key) => shouldRemoveKey(key, authKeySet));
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
}
