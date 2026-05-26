import { API_BASE_URL } from '@/constants/api';

const HEALTH_TIMEOUT_MS = 6000;

export type ApiHealthResult =
  | { ok: true }
  | { ok: false; message: string };

/** Quick check that the phone can reach the backend (same network / firewall). */
export async function checkApiHealth(): Promise<ApiHealthResult> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/health`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, message: `Server responded with ${res.status}` };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: `Cannot reach ${API_BASE_URL}. Two phones: set EXPO_PUBLIC_REMOTE_API_URL in frontend/.env (deployed backend), OR same Wi‑Fi + npm run start:2phones. Run npm run dev in backend/ and npm run dev:firewall (Admin).`,
    };
  }
}
