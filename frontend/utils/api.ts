import { API_BASE_URL, getApiConnectionHint } from '@/constants/api';
import { getAccessToken, getRefreshToken, updateAuthTokens } from '@/utils/authStorage';

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

/** Refresh access token when it is missing or close to expiry (games save often). */
async function ensureFreshAccessToken(): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  const expSec = decodeJwtExpSec(token);
  const expiresSoon =
    expSec !== null && expSec * 1000 <= Date.now() + 2 * 60 * 1000;

  if (expiresSoon) {
    await refreshAccessToken();
  }
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
    throw new Error(
      hint ??
        `Cannot reach server at ${API_BASE_URL}. Fix: (1) backend running — npm run dev in backend/, (2) same Wi‑Fi on phone and PC, (3) Windows — run npm run dev:firewall in backend/ as Administrator, (4) npm run sync-api in frontend/ then restart Expo with --clear.`
    );
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
