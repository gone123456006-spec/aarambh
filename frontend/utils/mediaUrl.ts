import { API_BASE_URL } from '@/constants/api';

/** Turn stored upload paths into a loadable URL on this device. */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL.replace(/\/$/, '')}${trimmed}`;
  }
  return `${API_BASE_URL.replace(/\/$/, '')}/uploads/${trimmed.replace(/^\/+/, '')}`;
}
