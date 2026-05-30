import { API_BASE_URL } from '@/constants/api';
import { formatReachabilityError } from '@/utils/apiErrors';

const HEALTH_TIMEOUT_MS = __DEV__ ? 8_000 : 25_000;
const HEALTH_RETRIES = __DEV__ ? 1 : 4;
const RETRY_DELAY_MS = 2_500;

export type ApiHealthResult =
  | { ok: true }
  | { ok: false; message: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Quick check that the device can reach the backend API. Retries on Render cold start. */
export async function checkApiHealth(): Promise<ApiHealthResult> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/health`;
  let lastStatus: number | undefined;
  let timedOut = false;

  for (let attempt = 1; attempt <= HEALTH_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);

      if (!res.ok) {
        lastStatus = res.status;
        if (attempt < HEALTH_RETRIES) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        return {
          ok: false,
          message: formatReachabilityError({ status: res.status }),
        };
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        timedOut = true;
      }
      if (attempt < HEALTH_RETRIES) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      return {
        ok: false,
        message: formatReachabilityError({ timedOut, status: lastStatus }),
      };
    }
  }

  return { ok: false, message: formatReachabilityError({ timedOut, status: lastStatus }) };
}

/** Fire-and-forget ping so Render wakes during splash (production only). */
export function warmApiServer(): void {
  if (__DEV__) return;
  void checkApiHealth();
}
