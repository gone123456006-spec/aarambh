import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutSession } from '@/utils/authApi';
import { AUTH_KEYS, clearAuthSession } from '@/utils/authStorage';
import { disconnectChatSocket } from '@/utils/chatSocket';

/** Revoke refresh token on server, disconnect sockets, clear local session. */
export async function performLogout(): Promise<void> {
  const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.refreshToken);
  try {
    await logoutSession(refreshToken);
  } catch {
    // Still sign out locally if the server is unreachable
  }
  disconnectChatSocket();
  await clearAuthSession();
}
