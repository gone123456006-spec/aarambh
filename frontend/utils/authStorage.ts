import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authKeys';
import { clearAllLocalUserData, clearUserScopedCache } from '@/utils/userStorage';

export { AUTH_KEYS };

export async function saveAuthSession(payload: {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    phone?: string;
    gender?: string;
    region?: string;
    level?: string;
    avatar?: string;
  };
}) {
  // Write auth tokens first so a crash mid-save never leaves the user logged out.
  const entries: [string, string][] = [
    [AUTH_KEYS.accessToken, payload.accessToken],
    [AUTH_KEYS.refreshToken, payload.refreshToken],
    [AUTH_KEYS.userId, payload.user.id],
    [AUTH_KEYS.userEmail, payload.user.email],
    [AUTH_KEYS.userName, payload.user.name ?? ''],
    [AUTH_KEYS.userAvatar, payload.user.avatar ?? ''],
    [AUTH_KEYS.userPhone, payload.user.phone ?? ''],
    [AUTH_KEYS.gender, payload.user.gender ?? ''],
    [AUTH_KEYS.userRegion, payload.user.region ?? ''],
    [AUTH_KEYS.level, payload.user.level ?? ''],
  ];

  await AsyncStorage.multiSet(entries);
  await clearUserScopedCache();
}

export async function getAccessToken() {
  return AsyncStorage.getItem(AUTH_KEYS.accessToken);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(AUTH_KEYS.refreshToken);
}

/** True while access or refresh token is stored — only cleared by explicit Logout. */
export async function isLoggedInLocally(): Promise<boolean> {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);
  return !!(accessToken || refreshToken);
}

export async function updateAuthUserAvatar(avatar: string) {
  await AsyncStorage.setItem(AUTH_KEYS.userAvatar, avatar);
}

/** Persist tokens after login or /api/auth/refresh-token. Never clears the session. */
export async function updateAuthTokens(accessToken: string, refreshToken?: string) {
  const pairs: [string, string][] = [[AUTH_KEYS.accessToken, accessToken]];
  if (refreshToken) {
    pairs.push([AUTH_KEYS.refreshToken, refreshToken]);
  }
  await AsyncStorage.multiSet(pairs);
}

/** Clear tokens and local user cache. Call only from manual Logout / account deletion. */
export async function clearAuthSession() {
  await clearAllLocalUserData();
}
