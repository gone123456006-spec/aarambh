import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '5000';

/** Deployed backend on Render */
export const RENDER_API_URL = 'https://aarambh-api.onrender.com';

/** True for 192.168.x.x / 172.x.x.x style hosts from `expo start --lan`. */
function isLanIpHost(host: string): boolean {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  const parts = host.split('.').map(Number);
  return parts.every((n) => n >= 0 && n <= 255);
}

function isTunnelMetroHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes('.exp.direct') || h.includes('ngrok') || h.includes('.exp.host');
}

/**
 * Metro host from Expo Go — valid for API only when it is your PC's LAN IP (LAN mode).
 */
function getExpoLanHost(): string | null {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;

  if (!debuggerHost) return null;

  const host = debuggerHost.split(':')[0]?.trim();
  if (host && isLanIpHost(host)) {
    return host;
  }
  return null;
}

function getFallbackDevHost(): string {
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return 'localhost';
}

/**
 * Dev priority (two phones / Expo tunnel):
 * 1. EXPO_PUBLIC_REMOTE_API_URL — HTTPS backend any phone can reach (Render, etc.)
 * 2. Expo LAN IP from debuggerHost — each phone on same Wi‑Fi with `expo start --lan`
 * 3. EXPO_PUBLIC_API_URL in .env — your PC LAN IP
 */
function resolveApiBaseUrl(): string {
  const remoteFromEnv = process.env.EXPO_PUBLIC_REMOTE_API_URL?.trim();
  if (remoteFromEnv) {
    return remoteFromEnv.replace(/\/$/, '');
  }

  // Release APK / production: Render (env from EAS or .env, else constant)
  if (!__DEV__) {
    const prodUrl =
      process.env.EXPO_PUBLIC_REMOTE_API_URL?.trim() ||
      process.env.EXPO_PUBLIC_API_URL?.trim();
    if (prodUrl) {
      return prodUrl.replace(/\/$/, '');
    }
    return RENDER_API_URL.replace(/\/$/, '');
  }

  const lanFromExpo = getExpoLanHost();
  if (lanFromExpo) {
    return `http://${lanFromExpo}:${API_PORT}`;
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const host = getFallbackDevHost();
  return `http://${host}:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function isUsingRemoteApiInDev(): boolean {
  return __DEV__ && API_BASE_URL.includes('onrender.com');
}

/** Hint when tunnel + local-only API (second phone on another network will fail). */
export function getApiConnectionHint(): string | null {
  if (!__DEV__) return null;

  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    '';

  const isTunnel = isTunnelMetroHost(debuggerHost);
  const usesLocalOnly =
    !isUsingRemoteApiInDev() &&
    (API_BASE_URL.includes('localhost') ||
      API_BASE_URL.includes('127.0.0.1') ||
      isLanIpHost(API_BASE_URL.replace(/^https?:\/\//, '').split(':')[0] ?? ''));

  if (isTunnel && usesLocalOnly) {
    return (
      'Two phones: Expo tunnel only loads the app. Set EXPO_PUBLIC_REMOTE_API_URL to your deployed backend (https://…) in frontend/.env, or put both phones on the same Wi‑Fi and use npm run start:lan.'
    );
  }
  return null;
}

if (__DEV__) {
  console.log('[API] Base URL:', API_BASE_URL);
  const hint = getApiConnectionHint();
  if (hint) console.warn('[API]', hint);
}
