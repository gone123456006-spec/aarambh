import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  deleteAllNotifications,
  formatNotificationTime,
  notificationIcon,
  NotificationType,
} from '@/utils/notificationApi';
import { AppUI } from '@/constants/theme';

const ICON_COLORS: Partial<Record<NotificationType, string>> = {
  welcome: '#e60000',
  reward: '#D97706',
  course: '#1A73E8',
  game: '#7C3AED',
  points: '#D97706',
  leaderboard: '#EA580C',
  subscription: '#6D28D9',
  chat: '#0D9488',
  call: '#059669',
  achievement: '#B45309',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function TypeIcon({ type, read }: { type: NotificationType; read: boolean }) {
  const color = read ? '#9CA3AF' : ICON_COLORS[type] || AppUI.textSecondary;

  if (type === 'subscription') {
    return (
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="crown-outline" size={19} color={color} />
      </View>
    );
  }

  return (
    <View style={styles.iconWrap}>
      <Feather
        name={notificationIcon(type) as keyof typeof Feather.glyphMap}
        size={17}
        color={color}
      />
    </View>
  );
}

type Section = { title: string; data: AppNotification[] };

function groupNotifications(items: AppNotification[]): Section[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const today: AppNotification[] = [];
  const week: AppNotification[] = [];
  const earlier: AppNotification[] = [];

  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (Number.isNaN(t)) {
      earlier.push(n);
      continue;
    }
    if (t >= todayMs) today.push(n);
    else if (t >= todayMs - 6 * DAY_MS) week.push(n);
    else earlier.push(n);
  }

  const sections: Section[] = [];
  if (today.length) sections.push({ title: 'Today', data: today });
  if (week.length) sections.push({ title: 'This week', data: week });
  if (earlier.length) sections.push({ title: 'Earlier', data: earlier });
  return sections;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sections = useMemo(() => groupNotifications(items), [items]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    try {
      const data = await fetchNotifications();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
      setLoadError(null);
    } catch (e) {
      // Keep previous list on failure so the screen doesn't flicker to empty
      setLoadError(e instanceof Error ? e.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openNotification = async (item: AppNotification) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      void markNotificationRead(item._id);
    }

    const route = item.data?.route;
    if (typeof route === 'string' && route.length > 0) {
      router.push(route as never);
    }
  };

  const handleMarkAll = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    void markAllNotificationsRead();
  };

  const handleDeleteOne = (item: AppNotification) => {
    Alert.alert('Delete notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((n) => n._id !== item._id));
          if (!item.read) setUnreadCount((c) => Math.max(0, c - 1));
          void deleteNotification(item._id)
            .then((count) => setUnreadCount(count))
            .catch(() => {
              // Restore on failure
              void load({ silent: true });
            });
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    if (items.length === 0) return;
    Alert.alert('Delete all notifications', 'This will clear your entire notification list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          const previous = items;
          setItems([]);
          setUnreadCount(0);
          void deleteAllNotifications().catch(() => {
            setItems(previous);
            void load({ silent: true });
          });
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => void openNotification(item)}
          onLongPress={() => handleDeleteOne(item)}
          delayLongPress={350}
          activeOpacity={0.6}
        >
          <TypeIcon type={item.type} read={item.read} />

          <View style={styles.rowBody}>
            <View style={styles.rowTopLine}>
              <Text
                style={[styles.rowTitle, !item.read && styles.rowTitleUnread]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.rowTime}>{formatNotificationTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.rowMessage} numberOfLines={2}>
              {item.message}
            </Text>
          </View>

          {!item.read ? <View style={styles.unreadDot} /> : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteOne(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Delete notification"
        >
          <Feather name="trash-2" size={16} color={AppUI.textTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.rowLine} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={AppUI.bg} />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={22} color={AppUI.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={handleDeleteAll} hitSlop={8} style={styles.headerAction}>
            <Text style={styles.deleteAllText}>Clear all</Text>
          </TouchableOpacity>
        ) : unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAll} hitSlop={8} style={styles.headerAction}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {items.length > 0 && unreadCount > 0 ? (
        <TouchableOpacity onPress={handleMarkAll} style={styles.markAllBar}>
          <Text style={styles.markAllBarText}>Mark all as read</Text>
        </TouchableOpacity>
      ) : null}

      {loadError && items.length === 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={AppUI.accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderSectionFooter={() => <View style={styles.sectionFooter} />}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.list,
            sections.length === 0 && styles.listEmpty,
            { paddingBottom: insets.bottom + 28 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppUI.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={26} color={AppUI.textTertiary} />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySub}>
                Updates about your courses, rewards, and games will show up here.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppUI.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: AppUI.bg,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: AppUI.text,
  },
  headerSpacer: {
    width: 36,
  },
  headerAction: {
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppUI.accent,
  },
  deleteAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppUI.textSecondary,
  },
  markAllBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  markAllBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppUI.accent,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: AppUI.textSecondary,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppUI.accent,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: AppUI.textSecondary,
    marginBottom: 4,
    marginTop: 4,
  },
  sectionFooter: {
    height: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  deleteBtn: {
    paddingLeft: 8,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowBody: {
    flex: 1,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: AppUI.text,
  },
  rowTitleUnread: {
    fontWeight: '700',
  },
  rowTime: {
    fontSize: 11,
    color: AppUI.textTertiary,
  },
  rowMessage: {
    fontSize: 13,
    color: AppUI.textSecondary,
    lineHeight: 18,
    marginTop: 3,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AppUI.accent,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppUI.text,
    marginTop: 6,
  },
  emptySub: {
    fontSize: 13,
    color: AppUI.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
