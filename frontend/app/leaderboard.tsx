import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icons3D } from '@/constants/homeIcons';
import {
  fetchLeaderboard,
  LeaderboardEntry,
} from '@/utils/leaderboardApi';
import UserAvatar from '@/components/UserAvatar';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const UI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  text: '#101010',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#e60000',
  border: '#E8EAED',
};

/* Medal colours for rank 1/2/3 */
const MEDAL_COLOR: Record<number, string> = {
  1: '#FFD700',  // Gold
  2: '#C0C0C0',  // Silver
  3: '#CD7F32',  // Bronze
};
/* Medal emoji shown next to rank number in the list */
const MEDAL_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const LB_TROPHY_LOGO = Icons3D.trophy;
const LB_CROWN_LOGO = Icons3D.crown;

/** Height of the tab-bar so the ScrollView doesn't clip under it */
const TAB_BAR_HEIGHT = 88;
/** Extra breathing room above the floating footer card */
const FOOTER_LIFT = 20;
/** Auto-refresh interval (ms) */
const REFRESH_MS = 15_000;

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rankings, setRankings] = React.useState<LeaderboardEntry[]>([]);
  const [me, setMe] = React.useState<LeaderboardEntry | null>(null);
  const [totalUsers, setTotalUsers] = React.useState(0);

  /* ── Data fetch ───────────────────────────────────────────────────────── */
  const loadLeaderboard = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setError(null);
      const data = await fetchLeaderboard();
      // Backend already sorts by points DESC → _id ASC and assigns integer ranks.
      setRankings(data.rankings);
      setMe(data.me);
      setTotalUsers(data.totalUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* Initial load */
  React.useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  /* Auto-refresh whenever the screen is in focus */
  useFocusEffect(
    React.useCallback(() => {
      loadLeaderboard(true);
      const id = setInterval(() => void loadLeaderboard(true), REFRESH_MS);
      return () => clearInterval(id);
    }, [loadLeaderboard])
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadLeaderboard(true);
  }, [loadLeaderboard]);

  /* ── Derived data ─────────────────────────────────────────────────────── */
  /** Top 3 — rendered as the podium splash at the top */
  const topThree = rankings.slice(0, 3);
  /** Ranks 4-10 — rendered in the numbered list below the podium */
  const ranksFourToTen = rankings.slice(3, 10);
  /** The logged-in user's rank & points (always comes from the `me` field) */
  const myRank = me?.rank ?? 0;
  const myPoints = me?.points ?? 0;

  /* ── Sub-renderers ────────────────────────────────────────────────────── */

  /** Gold / Silver / Bronze circle badge (used inside podium cards) */
  const renderMedalBadge = (rank: number) => (
    <View
      style={[
        styles.medalBadge,
        { backgroundColor: MEDAL_COLOR[rank] ?? '#9CA3AF' },
      ]}
    >
      <Text style={styles.medalBadgeText}>{rank}</Text>
    </View>
  );

  /** One podium card (rank 1 is taller; all three share the same base style) */
  const renderPodiumCard = (
    user: LeaderboardEntry,
    cardStyle: object,
    animIndex: number,
  ) => (
    <Animated.View
      key={user.id}
      entering={FadeInUp.delay(animIndex * 120).duration(480)}
      style={[
        styles.podiumCard,
        cardStyle,
        user.rank === 1 && styles.podiumCardFirst,
        user.isMe && styles.podiumCardMe,
      ]}
    >
      {renderMedalBadge(user.rank)}
      {user.rank === 1 ? (
        <Image source={LB_CROWN_LOGO} style={styles.crownIcon} resizeMode="contain" />
      ) : null}
      <UserAvatar name={user.name} avatar={user.avatar} size={54} highlighted={user.isMe} />
      <Text style={styles.podiumName} numberOfLines={1}>
        {user.isMe ? 'You' : user.name}
      </Text>
      <Text style={styles.podiumPoints}>{user.points.toLocaleString()} pts</Text>
      {user.location ? (
        <View style={styles.podiumLocRow}>
          <Ionicons name="location-outline" size={10} color={UI.textMuted} />
          <Text style={styles.podiumLoc} numberOfLines={1}>{user.location}</Text>
        </View>
      ) : null}
    </Animated.View>
  );

  /** One row in the ranks-4-10 list */
  const renderListRow = (user: LeaderboardEntry, index: number, total: number) => {
    const medalColor = MEDAL_COLOR[user.rank];
    const medalEmoji = MEDAL_EMOJI[user.rank];
    return (
      <Animated.View
        key={user.id}
        entering={FadeInDown.delay(index * 60).duration(350)}
      >
        <View style={[styles.row, user.isMe && styles.rowMe]}>

          {/* Rank number + optional medal emoji */}
          <View style={styles.rowRankWrap}>
            {medalEmoji ? (
              <Text style={styles.rowMedalEmoji}>{medalEmoji}</Text>
            ) : (
              <Text
                style={[
                  styles.rowRank,
                  user.isMe && styles.rowRankMe,
                ]}
              >
                {user.rank}
              </Text>
            )}
          </View>

          {/* Avatar + name */}
          <View style={styles.rowUser}>
            <UserAvatar name={user.name} avatar={user.avatar} size={42} highlighted={user.isMe} />
            <View style={styles.rowNameBlock}>
              <Text
                style={[styles.rowName, user.isMe && styles.rowNameMe]}
                numberOfLines={1}
              >
                {user.isMe ? `${user.name} (You)` : user.name}
              </Text>
              {user.location ? (
                <View style={styles.rowLocRow}>
                  <Ionicons name="location-outline" size={11} color={UI.textMuted} />
                  <Text style={styles.rowLoc} numberOfLines={1}>{user.location}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Points */}
          <Text style={[styles.rowPts, user.isMe && styles.rowPtsMe]}>
            {user.points.toLocaleString()}
          </Text>
        </View>

        {index < total - 1 ? <View style={styles.rowDivider} /> : null}
      </Animated.View>
    );
  };

  /** Header bar with back button + title + my-rank pill */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={UI.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          {!loading && totalUsers > 0 ? (
            <Text style={styles.headerSub}>{totalUsers.toLocaleString()} participants</Text>
          ) : null}
        </View>

        {!loading && myRank > 0 ? (
          <Animated.View entering={ZoomIn.duration(400)} style={styles.rankPill}>
            <Text style={styles.rankPillText}>#{myRank}</Text>
          </Animated.View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    </View>
  );

  /* ── Guard screens ────────────────────────────────────────────────────── */
  if (loading && rankings.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />
        {renderHeader()}
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={UI.accent} />
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        </View>
      </View>
    );
  }

  if (error && rankings.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />
        {renderHeader()}
        <View style={styles.centerBox}>
          <Image source={LB_TROPHY_LOGO} style={styles.emptyLogo} resizeMode="contain" />
          <Text style={styles.emptyTitle}>Could not load leaderboard</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadLeaderboard()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (rankings.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />
        {renderHeader()}
        <View style={styles.centerBox}>
          <Image source={LB_TROPHY_LOGO} style={styles.emptyLogo} resizeMode="contain" />
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySub}>Earn points in games and daily rewards to appear here</Text>
        </View>
      </View>
    );
  }

  /* ── Main render ──────────────────────────────────────────────────────── */
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />
        {renderHeader()}

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={UI.accent} />
          }
          contentContainerStyle={[
            styles.scroll,
            {
              // Leave room for the sticky "My Rank" footer
              paddingBottom: TAB_BAR_HEIGHT + insets.bottom + FOOTER_LIFT + 80,
            },
          ]}
        >

          {/* ── Podium – Top 3 ──────────────────────────────────────────── */}
          {topThree.length > 0 ? (
            <View style={styles.podiumWrapper}>
              <LinearGradient
                colors={['rgba(230,0,0,0)', 'rgba(230,0,0,0.04)', 'rgba(230,0,0,0.09)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.podiumLabelRow}>
                <MaterialCommunityIcons name="trophy-outline" size={14} color={UI.accent} />
                <Text style={styles.podiumLabel}>TOP 3</Text>
              </View>
              <View style={styles.podium}>
                {/* Silver – rank 2 */}
                {topThree[1]
                  ? renderPodiumCard(topThree[1], styles.cardSilver, 1)
                  : <View style={styles.cardSilver} />}
                {/* Gold – rank 1 (centre, tallest) */}
                {topThree[0]
                  ? renderPodiumCard(topThree[0], styles.cardGold, 0)
                  : null}
                {/* Bronze – rank 3 */}
                {topThree[2]
                  ? renderPodiumCard(topThree[2], styles.cardBronze, 2)
                  : <View style={styles.cardBronze} />}
              </View>
            </View>
          ) : null}

          {/* ── Ranks 4 – 10 list ───────────────────────────────────────── */}
          {ranksFourToTen.length > 0 ? (
            <View style={styles.listCard}>
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>Rankings #4 – #10</Text>
                <Text style={styles.listHeaderSub}>Sorted by total points earned</Text>
              </View>
              {ranksFourToTen.map((user, idx) =>
                renderListRow(user, idx, ranksFourToTen.length)
              )}
            </View>
          ) : null}

          {/* ── "Your Position" card — only when user is outside top 10 ── */}
          {me && myRank > 10 ? (
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.outsideCard}>
              <View style={styles.outsideCardHeader}>
                <Feather name="award" size={13} color={UI.accent} />
                <Text style={styles.outsideCardLabel}>YOUR POSITION</Text>
              </View>
              <View style={styles.outsideCardBody}>
                <View style={styles.outsideRankBadge}>
                  <Text style={styles.outsideRankText}>#{myRank}</Text>
                </View>
                <UserAvatar name={me.name} avatar={me.avatar} size={44} highlighted />
                <View style={styles.outsideInfo}>
                  <Text style={styles.outsideName} numberOfLines={1}>{me.name}</Text>
                  <Text style={styles.outsideSub}>
                    {totalUsers > 0
                      ? `Rank ${myRank} of ${totalUsers.toLocaleString()} users`
                      : 'Keep earning to climb up!'}
                  </Text>
                </View>
                <View style={styles.outsidePtsBlock}>
                  <Text style={styles.outsidePts}>{myPoints.toLocaleString()}</Text>
                  <Text style={styles.outsidePtsLabel}>pts</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

        </ScrollView>

        {/* ── Sticky "My Rank" footer — always visible ─────────────────── */}
        {me ? (
          <View
            style={[
              styles.footer,
              { bottom: insets.bottom + FOOTER_LIFT },
            ]}
          >
            {/* Eyebrow */}
            <View style={styles.footerEyebrowRow}>
              <Feather name="user" size={12} color={UI.accent} />
              <Text style={styles.footerEyebrow}>MY RANK</Text>
            </View>

            {/* Main row: avatar · name · position · points · rank badge */}
            <View style={styles.footerBody}>
              <UserAvatar name={me.name} avatar={me.avatar} size={44} highlighted />

              <View style={styles.footerInfo}>
                <Text style={styles.footerName} numberOfLines={1}>{me.name}</Text>
                <Text style={styles.footerMeta}>
                  {myRank > 0 && totalUsers > 0
                    ? `Position ${myRank} of ${totalUsers.toLocaleString()}`
                    : 'Earning points…'}
                </Text>
              </View>

              {/* Points block */}
              <View style={styles.footerPtsBlock}>
                <Text style={styles.footerPts}>{myPoints.toLocaleString()}</Text>
                <Text style={styles.footerPtsLabel}>points</Text>
              </View>

              {/* Rank badge */}
              <View style={styles.footerRankBadge}>
                <Text style={styles.footerRankText}>#{myRank}</Text>
              </View>
            </View>
          </View>
        ) : null}

      </View>
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const { width: W } = Dimensions.get('window');

const shadow = (elevation = 4, opacity = 0.07): object =>
  Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: elevation }, shadowOpacity: opacity, shadowRadius: elevation * 2.5 },
    android: { elevation },
    default: {},
  }) ?? {};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.bg },

  /* ── Center / guard states ────────────────────────────────────────── */
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { color: UI.textSecondary, marginTop: 12, fontSize: 14 },
  emptyLogo: { width: 72, height: 72, opacity: 0.85 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: UI.text, marginTop: 16 },
  emptySub: { fontSize: 14, color: UI.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 20, backgroundColor: UI.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* ── Header ──────────────────────────────────────────────────────── */
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: UI.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: UI.surface, ...shadow(3) },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 21, fontWeight: '800', color: UI.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 12, color: UI.textSecondary, marginTop: 1 },
  headerSpacer: { width: 44 },
  rankPill: { backgroundColor: 'rgba(230,0,0,0.1)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  rankPillText: { fontSize: 14, fontWeight: '800', color: UI.accent },

  /* ── ScrollView ──────────────────────────────────────────────────── */
  scroll: { paddingTop: 4 },

  /* ── Podium ──────────────────────────────────────────────────────── */
  podiumWrapper: { marginHorizontal: 16, marginTop: 4, marginBottom: 12, borderRadius: 22, overflow: 'hidden' },
  podiumLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  podiumLabel: { fontSize: 11, fontWeight: '700', color: UI.accent, letterSpacing: 1, textTransform: 'uppercase' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, paddingTop: 20, paddingBottom: 22, gap: 6 },

  podiumCard: {
    width: (W - 44) / 3,
    backgroundColor: UI.surface,
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...shadow(5, 0.07),
  },
  cardGold: { height: 230, borderColor: '#FFD700', borderWidth: 1.5 },
  cardSilver: { height: 195 },
  cardBronze: { height: 195 },
  podiumCardFirst: { transform: [{ scale: 1.05 }], zIndex: 2 },
  podiumCardMe: { borderColor: UI.accent, borderWidth: 1.5, backgroundColor: '#fffcfc' },

  medalBadge: { position: 'absolute', top: -14, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  medalBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  crownIcon: { width: 30, height: 30, marginBottom: 2 },
  podiumName: { fontSize: 13, fontWeight: '700', color: UI.text, textAlign: 'center', marginTop: 8 },
  podiumPoints: { fontSize: 14, fontWeight: '800', color: UI.accent, marginVertical: 3 },
  podiumLocRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, paddingHorizontal: 4 },
  podiumLoc: { fontSize: 10, color: UI.textMuted, flexShrink: 1 },

  /* ── Ranks 4-10 list ─────────────────────────────────────────────── */
  listCard: { backgroundColor: UI.surface, borderRadius: 0, marginHorizontal: 0, paddingBottom: 8, ...shadow(3) },
  listHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: UI.border },
  listHeaderTitle: { fontSize: 16, fontWeight: '700', color: UI.text },
  listHeaderSub: { fontSize: 12, color: UI.textSecondary, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowMe: { backgroundColor: '#FFF8F8' },
  rowDivider: { height: 1, backgroundColor: UI.border, marginLeft: 76 },

  rowRankWrap: { width: 34, alignItems: 'center', justifyContent: 'center' },
  rowMedalEmoji: { fontSize: 20 },
  rowRank: { fontSize: 14, fontWeight: '700', color: UI.textSecondary },
  rowRankMe: { color: UI.accent },

  rowUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  rowNameBlock: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '500', color: UI.text },
  rowNameMe: { fontWeight: '800', color: UI.accent },
  rowLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  rowLoc: { fontSize: 12, color: UI.textMuted, flexShrink: 1 },
  rowPts: { minWidth: 64, textAlign: 'right', fontSize: 15, fontWeight: '700', color: UI.text },
  rowPtsMe: { color: UI.accent },

  /* ── "Your Position" card (outside top 10) ──────────────────────── */
  outsideCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FAD4D4',
    padding: 16,
  },
  outsideCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  outsideCardLabel: { fontSize: 10, fontWeight: '800', color: UI.accent, letterSpacing: 1, textTransform: 'uppercase' },
  outsideCardBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  outsideRankBadge: { backgroundColor: UI.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  outsideRankText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  outsideInfo: { flex: 1, minWidth: 0 },
  outsideName: { fontSize: 15, fontWeight: '700', color: UI.text },
  outsideSub: { fontSize: 12, color: UI.textSecondary, marginTop: 2 },
  outsidePtsBlock: { alignItems: 'flex-end' },
  outsidePts: { fontSize: 18, fontWeight: '800', color: UI.accent },
  outsidePtsLabel: { fontSize: 11, color: UI.textMuted, marginTop: 1 },

  /* ── Sticky "My Rank" footer ─────────────────────────────────────── */
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: UI.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 12 },
      default: {},
    }),
  },
  footerEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  footerEyebrow: { fontSize: 10, fontWeight: '800', color: UI.accent, letterSpacing: 1, textTransform: 'uppercase' },
  footerBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerInfo: { flex: 1, minWidth: 0 },
  footerName: { fontSize: 15, fontWeight: '700', color: UI.text },
  footerMeta: { fontSize: 12, color: UI.textSecondary, marginTop: 2 },
  footerPtsBlock: { alignItems: 'flex-end', marginRight: 4 },
  footerPts: { fontSize: 18, fontWeight: '800', color: UI.accent },
  footerPtsLabel: { fontSize: 11, color: UI.textMuted, marginTop: 1 },
  footerRankBadge: { backgroundColor: UI.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  footerRankText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
