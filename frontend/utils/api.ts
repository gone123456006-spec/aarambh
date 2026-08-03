import { API_BASE_URL, getApiConnectionHint } from '@/constants/api';
import { formatReachabilityError } from '@/utils/apiErrors';
import {
  getAccessToken,
  getRefreshToken,
  updateAuthTokens,
  isLoggedInLocally,
  clearAuthSession,
} from '@/utils/authStorage';
import { getDeviceId } from '@/utils/deviceId';
import { router } from 'expo-router';

type ApiJson = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: unknown;
};

type ApiFetchOptions = RequestInit & {
  /** Internal: prevent infinite refresh retry loop */
  _retryAfterRefresh?: boolean;
};

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

function decodeJwtExpSec(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    let json: string;
    if (typeof globalThis.atob === 'function') {
      json = globalThis.atob(padded);
    } else if (typeof (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer !== 'undefined') {
      json = (globalThis as { Buffer: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer.from(padded, 'base64').toString('utf8');
    } else {
      return null;
    }

    const data = JSON.parse(json) as { exp?: number };
    return typeof data.exp === 'number' ? data.exp : null;
  } catch {
    return null;
  }
}

function isAccessTokenExpired(accessToken: string): boolean {
  const expSec = decodeJwtExpSec(accessToken);
  if (expSec === null) return true;
  return expSec * 1000 <= Date.now();
}

function isAccessTokenExpiringSoon(accessToken: string): boolean {
  const expSec = decodeJwtExpSec(accessToken);
  if (expSec === null) return true;
  return expSec * 1000 <= Date.now() + 5 * 60 * 1000;
}

function isDeviceMismatch(status: number, code?: string, message?: string): boolean {
  if (code === 'DEVICE_MISMATCH') return true;
  if (status !== 401) return false;
  return /another device|active on another device/i.test(message || '');
}

/**
 * Restore or refresh tokens for API/chat.
 * Never clears local auth — only explicit Logout does that.
 */
export async function ensureValidSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  const accessToken = await getAccessToken();

  if (!refreshToken && !accessToken) {
    return false;
  }

  // Prefer refreshing when we only have a refresh token, or access is near expiry.
  if (refreshToken && (!accessToken || isAccessTokenExpiringSoon(accessToken))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return true;

    // Network / temporary refresh failure: keep using access token if still valid.
    if (accessToken && !isAccessTokenExpired(accessToken)) {
      return true;
    }

    // Tokens remain on device; caller may retry later. Do not clear session.
    // Return true so callers never treat a temporary network issue as "not logged in".
    return !!refreshToken || !!accessToken;
  }

  return !!accessToken;
}

/** Refresh tokens once when the app starts (keeps long sessions alive). */
export async function bootstrapSession(): Promise<void> {
  const loggedIn = await isLoggedInLocally();
  if (loggedIn) {
    await ensureValidSession();
  }
}

function isAuthExpired(status: number, message: string): boolean {
  if (status !== 401) return false;
  return /expired|not authorized|authorization denied|invalid token|session revoked/i.test(
    message
  );
}

/** Refresh access token using stored refresh token. Never clears local session. */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const deviceId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId,
        },
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      const json = (await response.json().catch(() => ({}))) as ApiJson & {
        data?: { accessToken?: string; refreshToken?: string };
      };

      if (isDeviceMismatch(response.status, json.code, json.message)) {
        return false;
      }

      if (!response.ok || !json.data?.accessToken) {
        return false;
      }

      await updateAuthTokens(json.data.accessToken, json.data.refreshToken ?? refreshToken);
      return true;
    } catch {
      // Offline / unreachable — keep local tokens intact.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T = ApiJson>(
  path: string,
  options: ApiFetchOptions = {},
  auth = true
): Promise<T> {
  const { _retryAfterRefresh, ...fetchOptions } = options;

  if (auth && !_retryAfterRefresh) {
    const sessionOk = await ensureValidSession();
    if (!sessionOk) {
      // Tokens are either missing (user genuinely never logged in) or unresolvable.
      // Never say "Please sign in" when tokens exist locally — it would force re-login.
      const stillLoggedIn = await isLoggedInLocally();
      if (stillLoggedIn) {
        throw new Error('Unable to refresh session right now. Check your connection and try again.');
      }
      throw new Error('Unable to refresh session right now. Check your connection and try again.');
    }
  }

  const deviceId = await getDeviceId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId,
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch {
    const hint = getApiConnectionHint();
    throw new Error(hint ?? formatReachabilityError());
  }

  const json = (await response.json().catch(() => ({}))) as ApiJson & T;

  if (!response.ok) {
    const message = json.message || `Request failed (${response.status})`;

    if (isDeviceMismatch(response.status, json.code, message)) {
      // Single device login restriction: Force immediate logout on this device
      void clearAuthSession().then(() => {
        try {
          if (router.canDismiss && router.canDismiss()) {
            router.dismissAll();
          }
        } catch { }
        router.replace('/intro');
      });
      throw new ApiRequestError(message, response.status, json.code, json.data);
    }

    if (
      auth &&
      !_retryAfterRefresh &&
      (isAuthExpired(response.status, message) || response.status === 401)
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch<T>(path, { ...fetchOptions, _retryAfterRefresh: true }, auth);
      }
      // Never say "sign in" — keep the user logged in; just surface a retry-able error.
      throw new Error('Unable to refresh session right now. Check your connection and try again.');
    }

    throw new ApiRequestError(message, response.status, json.code, json.data);
  }

  return json;
}
