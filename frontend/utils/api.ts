import { API_BASE_URL, getApiConnectionHint } from '@/constants/api';
import { getAccessToken } from '@/utils/authStorage';

type ApiJson = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

export async function apiFetch<T = ApiJson>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
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
    throw new Error(json.message || `Request failed (${response.status})`);
  }

  return json;
}
