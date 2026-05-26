import { API_BASE_URL } from '@/constants/api';

/** Socket.io uses the same host as the REST API */
export function getSocketUrl(): string {
  return API_BASE_URL.replace(/\/$/, '');
}
