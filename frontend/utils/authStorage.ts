import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllLocalUserData } from '@/utils/userStorage';

export const AUTH_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  userId: 'userId',
  userEmail: 'userEmail',
  userName: 'userName',
  userRegion: 'userRegion',
  gender: 'gender',
  level: 'level',
  userPhone: 'userPhone',
} as const;

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
  };
}) {
  await clearAllLocalUserData();

  const entries: [string, string][] = [
    [AUTH_KEYS.accessToken, payload.accessToken],
    [AUTH_KEYS.refreshToken, payload.refreshToken],
    [AUTH_KEYS.userId, payload.user.id],
    [AUTH_KEYS.userEmail, payload.user.email],
    [AUTH_KEYS.userName, payload.user.name ?? ''],
    [AUTH_KEYS.userPhone, payload.user.phone ?? ''],
    [AUTH_KEYS.gender, payload.user.gender ?? ''],
    [AUTH_KEYS.userRegion, payload.user.region ?? ''],
    [AUTH_KEYS.level, payload.user.level ?? ''],
  ];

  await AsyncStorage.multiSet(entries);
}

export async function getAccessToken() {
  return AsyncStorage.getItem(AUTH_KEYS.accessToken);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(AUTH_KEYS.refreshToken);
}

/** True while access or refresh token is stored — only cleared by explicit logout. */
export async function isLoggedInLocally(): Promise<boolean> {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);
  return !!(accessToken || refreshToken);
}

/** Persist rotated tokens after /api/auth/refresh-token */
export async function updateAuthTokens(accessToken: string, refreshToken?: string) {
  const pairs: [string, string][] = [[AUTH_KEYS.accessToken, accessToken]];
  if (refreshToken) {
    pairs.push([AUTH_KEYS.refreshToken, refreshToken]);
  }
  await AsyncStorage.multiSet(pairs);
}

export async function clearAuthSession() {
  await clearAllLocalUserData();
}
