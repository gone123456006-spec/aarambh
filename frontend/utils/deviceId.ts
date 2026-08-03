import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persists across logout so the same install keeps the same device identity. */
const DEVICE_ID_KEY = 'appDeviceId';

function createDeviceId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  // Fallback UUID v4 for older runtimes
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedDeviceId: string | null = null;

/** Stable device ID for this app install (survives logout, cleared on uninstall). */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    /* generate below */
  }

  const next = createDeviceId();
  cachedDeviceId = next;
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  } catch {
    /* still return in-memory id for this session */
  }
  return next;
}
