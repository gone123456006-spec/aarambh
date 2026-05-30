import { API_BASE_URL, getApiConnectionHint } from '@/constants/api';
import { formatReachabilityError } from '@/utils/apiErrors';
import { getAccessToken, getRefreshToken, updateAuthTokens, isLoggedInLocally } from '@/utils/authStorage';

type ApiJson = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

type ApiFetchOptions = RequestInit & {
  /** Internal: prevent infinite refresh retry loop */
  _retryAfterRefresh?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

function decodeJwtExpSec(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob !== 'function') return null;
    const json = atob(base64);
    const data = JSON.parse(json) as { exp?: number };
    return typeof data.exp === 'number' ? data.exp : null;
  } catch {
    return null;
  }
}

/** Restore or refresh tokens for API/chat. Never clears local session — logout is manual only. */
export async function ensureValidSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  const accessToken = await getAccessToken();

  if (!refreshToken && !accessToken) {
    return false;
  }

  if (!accessToken && refreshToken) {
    await refreshAccessToken();
    return true;
  }

  const expSec = accessToken ? decodeJwtExpSec(accessToken) : null;
  const expiresSoon =
    expSec === null || expSec * 1000 <= Date.now() + 5 * 60 * 1000;

  if (expiresSoon && refreshToken) {
    await refreshAccessToken();
  }

  return true;
}

/** Refresh tokens once when the app starts (keeps long sessions alive). */
export async function bootstrapSession(): Promise<void> {
  const loggedIn = await isLoggedInLocally();
  if (loggedIn) {
    await ensureValidSession();
  }
}

/** Refresh access token when it is missing or close to expiry (games save often). */
async function ensureFreshAccessToken(): Promise<void> {
  await ensureValidSession();
}

function isAuthExpired(status: number, message: string): boolean {
  if (status !== 401) return false;
  return /expired|not authorized|authorization denied|invalid token/i.test(message);
}

/** Rotate session using stored refresh token (mobile). */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const json = (await response.json().catch(() => ({}))) as ApiJson & {
        data?: { accessToken?: string; refreshToken?: string };
      };

      if (!response.ok || !json.data?.accessToken) {
        return false;
      }

      await updateAuthTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    } catch {
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
    await ensureFreshAccessToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

    if (
      auth &&
      !_retryAfterRefresh &&
      (isAuthExpired(response.status, message) || response.status === 401)
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch<T>(path, { ...fetchOptions, _retryAfterRefresh: true }, auth);
      }
    }

    throw new Error(message);
  }

  return json;
}
