import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authKeys';

/** Local cache keys that must never be shared across accounts on the same device. */
const USER_DATA_BASE_KEYS = [
  'completedLessons',
  'lastLessonId',
  'gameProgress',
  'gameStats',
  'totalGameScore',
  'dailyWordClaimedEpochDay',
  'dailyWordCompletedEpochDays',
  'dailyWordJourneyBonusClaimed',
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

/**
 * Storage key isolated per authenticated MongoDB user.
 * Throws if there is no logged-in user — prevents writing unscoped shared keys.
 */
export async function userScopedKey(baseKey: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Cannot access user data without a signed-in account');
  }
  return `${baseKey}@${userId}`;
}

function shouldRemoveKey(key: string, authKeySet: Set<string>): boolean {
  if (authKeySet.has(key)) return true;
  if (key.startsWith('leaderboard:')) return true;
  return USER_DATA_BASE_KEYS.some(
    (base) => key === base || key.startsWith(`${base}@`)
  );
}

/**
 * Remove user-specific cached data but keep auth tokens intact.
 * Used when switching accounts or syncing after login.
 */
export async function clearUserScopedCache(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const authKeySet = new Set<string>(Object.values(AUTH_KEYS));
  const toRemove = allKeys.filter((key) => {
    if (authKeySet.has(key)) return false;
    return shouldRemoveKey(key, authKeySet);
  });
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
}

/**
 * Remove all session tokens and user-specific cached data from this device.
 * Call only on Logout / account deletion.
 */
export async function clearAllLocalUserData(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const authKeySet = new Set<string>(Object.values(AUTH_KEYS));
  const toRemove = allKeys.filter((key) => shouldRemoveKey(key, authKeySet));
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
}
