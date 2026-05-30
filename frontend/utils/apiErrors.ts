import { API_BASE_URL } from '@/constants/api';

type ReachabilityOptions = {
  status?: number;
  timedOut?: boolean;
};

/** User-facing message when the app cannot reach the backend. */
export function formatReachabilityError(options?: ReachabilityOptions): string {
  if (__DEV__) {
    return `Cannot reach ${API_BASE_URL}. Set EXPO_PUBLIC_REMOTE_API_URL in frontend/.env (deployed backend), OR same Wi‑Fi + npm run start:2phones. Run npm run dev in backend/ and npm run dev:firewall (Admin).`;
  }

  if (options?.timedOut) {
    return "Ohm's server is waking up — this can take up to a minute the first time. Check your internet and tap Retry.";
  }

  if (options?.status) {
    return `Server error (${options.status}). Please try again in a moment.`;
  }

  return "Unable to connect to Ohm's servers. Check your internet connection and try again.";
}
