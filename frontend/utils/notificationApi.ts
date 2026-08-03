import { apiFetch, ensureValidSession } from '@/utils/api';

export type NotificationType =
  | 'system'
  | 'welcome'
  | 'reward'
  | 'course'
  | 'game'
  | 'points'
  | 'leaderboard'
  | 'subscription'
  | 'chat'
  | 'call'
  | 'achievement';

export type AppNotification = {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  key?: string;
  data?: { route?: string; [key: string]: unknown } | null;
  createdAt: string;
};

export type NotificationsPayload = {
  notifications: AppNotification[];
  unreadCount: number;
};

export const EMPTY_NOTIFICATIONS: NotificationsPayload = {
  notifications: [],
  unreadCount: 0,
};

/** Supports both legacy (array) and new ({ notifications, unreadCount }) API shapes. */
function normalizePayload(data: unknown): NotificationsPayload {
  if (!data) return EMPTY_NOTIFICATIONS;

  if (Array.isArray(data)) {
    const notifications = data as AppNotification[];
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    };
  }

  const payload = data as Partial<NotificationsPayload> & { created?: number };
  const notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
  return {
    notifications,
    unreadCount:
      typeof payload.unreadCount === 'number'
        ? payload.unreadCount
        : notifications.filter((n) => !n.read).length,
  };
}

/**
 * Fetch notifications. Server GET also auto-creates daily/welcome tips once.
 * Throws on network/auth failure so the UI can keep the last good list.
 */
export async function fetchNotifications(options?: {
  skipBootstrap?: boolean;
}): Promise<NotificationsPayload> {
  const sessionOk = await ensureValidSession();
  if (!sessionOk) {
    throw new Error('Please sign in to view notifications.');
  }

  const qs = options?.skipBootstrap ? '?bootstrap=0' : '';
  const res = await apiFetch<{ data: unknown }>(`/api/notifications${qs}`);
  return normalizePayload(res.data);
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const sessionOk = await ensureValidSession();
    if (!sessionOk) return 0;
    const res = await apiFetch<{ data: { unreadCount: number } }>('/api/notifications/unread-count');
    return res.data?.unreadCount || 0;
  } catch {
    return 0;
  }
}

/** Call after login to seed welcome / daily tips. */
export async function bootstrapNotifications(isLogin = false): Promise<NotificationsPayload> {
  try {
    const sessionOk = await ensureValidSession();
    if (!sessionOk) return EMPTY_NOTIFICATIONS;

    const res = await apiFetch<{ data: unknown }>('/api/notifications/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ isLogin }),
    });
    return normalizePayload(res.data);
  } catch {
    try {
      return await fetchNotifications();
    } catch {
      return EMPTY_NOTIFICATIONS;
    }
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
  } catch {
    /* ignore */
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await apiFetch('/api/notifications/read-all', { method: 'PUT' });
  } catch {
    /* ignore */
  }
}

export async function deleteNotification(id: string): Promise<number> {
  const res = await apiFetch<{ data: { unreadCount?: number } }>(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
  return res.data?.unreadCount ?? 0;
}

export async function deleteAllNotifications(): Promise<void> {
  await apiFetch('/api/notifications', { method: 'DELETE' });
}

/** Report a client-side event (e.g. daily reward claimed). */
export async function reportNotificationEvent(
  event: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    const sessionOk = await ensureValidSession();
    if (!sessionOk) return;
    await apiFetch('/api/notifications/events', {
      method: 'POST',
      body: JSON.stringify({ event, payload }),
    });
  } catch {
    // Non-blocking — never break reward/game flows for notifications.
  }
}

export function notificationIcon(type: NotificationType): string {
  switch (type) {
    case 'welcome':
      return 'smile';
    case 'reward':
      return 'gift';
    case 'course':
      return 'book-open';
    case 'game':
      return 'zap';
    case 'points':
      return 'star';
    case 'leaderboard':
      return 'award';
    case 'subscription':
      return 'crown';
    case 'chat':
      return 'message-circle';
    case 'call':
      return 'phone';
    case 'achievement':
      return 'award';
    default:
      return 'bell';
  }
}

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
