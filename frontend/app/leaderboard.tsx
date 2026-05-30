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
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import { getCurrentUserId } from '@/utils/userStorage';
import { getTotalGameScore } from '@/utils/gameStats';
import { Icons3D } from '@/constants/homeIcons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardUser {
  id: string;
  name: string;
  points: number;
  location: string;
  isMe?: boolean;
  rank?: number;
}

// ─── Shared-leaderboard key (all devices write here) ─────────────────────────
// Each entry stored under "leaderboard:<userId>"
// Entry shape: { id, name, points, location, updatedAt }

const LB_PREFIX = 'leaderboard:';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthenticatedUserId(): Promise<string> {
  const id = await getCurrentUserId();
  return id ?? '';
}

/** Write this user's latest score into the shared leaderboard store */
async function pushMyScore(name: string, points: number, location: string) {
  const id = await getAuthenticatedUserId();
  if (!id) return;
  const entry = JSON.stringify({ id, name, points, location, updatedAt: Date.now() });
  await AsyncStorage.setItem(`${LB_PREFIX}${id}`, entry);
}

/** Read ALL leaderboard entries from AsyncStorage */
async function fetchAllEntries(): Promise<LeaderboardUser[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const lbKeys = allKeys.filter((k) => k.startsWith(LB_PREFIX));
  if (lbKeys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(lbKeys);
  return pairs
    .map(([, value]) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as LeaderboardUser;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as LeaderboardUser[];
}

// ─── Medal colours ────────────────────────────────────────────────────────────
const MEDAL = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

const LB_TROPHY_LOGO = Icons3D.trophy;
const LB_CROWN_LOGO = Icons3D.crown;

/** Space between sticky footer and bottom nav / home indicator */
const FOOTER_BOTTOM_GAP = 20;
const FOOTER_BAR_HEIGHT = 72;

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = React.useState(true);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardUser[]>([]);
  const [myId, setMyId] = React.useState('');
  const [myScore, setMyScore] = React.useState(0);
  const [myRank, setMyRank] = React.useState(0);

  const loadLeaderboard = React.useCallback(async () => {
    setLoading(true);
    try {
      const [score, name, region, id] = await Promise.all([
        getTotalGameScore(),
        AsyncStorage.getItem(AUTH_KEYS.userName),
        AsyncStorage.getItem(AUTH_KEYS.userRegion),
        getAuthenticatedUserId(),
      ]);
      const displayName = name?.trim() || 'You';
      const displayRegion = region?.trim() || '';

      setMyId(id);
      setMyScore(score);

      await pushMyScore(displayName, score, displayRegion);

      const entries = await fetchAllEntries();
      const sorted = entries
        .map((e) => ({ ...e, isMe: e.id === id }))
        .sort((a, b) => b.points - a.points)
        .map((e, i) => ({ ...e, rank: i + 1 }));

      setLeaderboard(sorted);
      setMyRank(sorted.find((e) => e.isMe)?.rank ?? sorted.length + 1);
    } catch (err) {
      console.error('Leaderboard load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useFocusEffect(
    React.useCallback(() => {
      loadLeaderboard();
    }, [loadLeaderboard])
  );

  // ── Derived slices ────────────────────────────────────────────────────────
  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const me = leaderboard.find((e) => e.isMe);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderMedalBadge = (rank: number) => (
    <View style={[styles.rankBadge, { backgroundColor: MEDAL[rank as 1 | 2 | 3] ?? '#999' }]}>
      <Text style={styles.rankBadgeText}>{rank}</Text>
    </View>
  );

  const renderTopCard = (user: LeaderboardUser, heightStyle: any, index: number) => (
    <Animated.View
      key={user.id}
      entering={FadeInUp.delay(index * 100).duration(500)}
      style={[
        styles.topCard,
        heightStyle,
        user.rank === 1 && styles.topCardFirst,
        user.isMe && styles.topCardMe,
      ]}
    >
      {renderMedalBadge(user.rank!)}
      {user.rank === 1 && (
        <Image source={LB_CROWN_LOGO} style={styles.crownLogo} resizeMode="contain" />
      )}
      <View style={styles.topAvatarCircle}>
        <Text style={styles.topAvatarLetter}>{user.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.topName} numberOfLines={1}>{user.name}</Text>
      <Text style={styles.topPoints}>{user.points.toLocaleString()} pts</Text>
      {user.location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={10} color="#888" />
          <Text style={styles.topLocation} numberOfLines={1}>{user.location}</Text>
        </View>
      ) : null}
    </Animated.View>
  );

  // ── UI ────────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={24} color="#101010" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Leaderboard
        </Text>
        {!loading && leaderboard.length > 0 ? (
          <View style={styles.rankPill}>
            <Text style={styles.rankPillText}>#{myRank}</Text>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
      <Text style={styles.headerSub}>All-time rankings</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor="#F2F3F7" />
        {renderHeader()}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#e60000" />
          <Text style={styles.loadingText}>Loading scores…</Text>
        </View>
      </View>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor="#F2F3F7" />
        {renderHeader()}
        <View style={styles.emptyBox}>
          <Image source={LB_TROPHY_LOGO} style={styles.emptyLogo} resizeMode="contain" />
          <Text style={styles.emptyTitle}>No scores yet</Text>
          <Text style={styles.emptySub}>Play games to appear on the leaderboard</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F2F3F7" />
        {renderHeader()}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom:
                FOOTER_BAR_HEIGHT + insets.bottom + FOOTER_BOTTOM_GAP + (me ? 16 : 24),
            },
          ]}
        >
          {/* ── Top-3 podium ── */}
          {topThree.length >= 1 && (
            <View style={styles.podiumWrapper}>
              <LinearGradient 
                colors={['#fff', '#fdf2f2', '#fff0f0']} 
                style={styles.podiumGradient} 
              />
              <View style={styles.podium}>
                {/* Silver – rank 2 (left) */}
                {topThree[1]
                  ? renderTopCard(topThree[1], styles.cardSilver, 1)
                  : <View style={styles.cardSilver} />}

                {/* Gold – rank 1 (centre, tallest) */}
                {topThree[0] && renderTopCard(topThree[0], styles.cardGold, 0)}

                {/* Bronze – rank 3 (right) */}
                {topThree[2]
                  ? renderTopCard(topThree[2], styles.cardBronze, 2)
                  : <View style={styles.cardBronze} />}
              </View>
            </View>
          )}

          {/* ── Rest of list ── */}
          {rest.length > 0 && (
            <View style={styles.listCard}>
              <View style={styles.listSectionHeader}>
                <Text style={styles.listSectionTitle}>Rankings</Text>
                <View style={styles.listSectionLine} />
              </View>
              <View style={styles.listHead}>
                <Text style={[styles.listHeadTxt, { width: 36 }]}>#</Text>
                <Text style={[styles.listHeadTxt, { flex: 1 }]}>Player</Text>
                <Text style={[styles.listHeadTxt, { width: 72, textAlign: 'right' }]}>Score</Text>
                <Text style={[styles.listHeadTxt, { width: 80, textAlign: 'right' }]}>Region</Text>
              </View>

              {rest.map((user, index) => (
                <View key={user.id}>
                <View
                  style={[styles.row, user.isMe && styles.rowMe]}
                >
                  <Text style={[styles.rowRank, user.isMe && { color: '#e60000' }]}>
                    {user.rank}
                  </Text>
                  <View style={styles.rowUser}>
                    <View style={[styles.miniAvatar, user.isMe && styles.miniAvatarMe]}>
                      <Text style={styles.miniAvatarLetter}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.rowName, user.isMe && { fontWeight: '800', color: '#e60000' }]}
                      numberOfLines={1}>
                      {user.isMe ? `${user.name} (You)` : user.name}
                    </Text>
                  </View>
                  <Text style={[styles.rowPts, user.isMe && { color: '#e60000' }]}>
                    {user.points.toLocaleString()}
                  </Text>
                  <View style={styles.rowLocRow}>
                    {user.location ? (
                      <>
                        <Ionicons name="location-outline" size={10} color="#aaa" />
                        <Text style={styles.rowLoc} numberOfLines={1}>{user.location}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                {index < rest.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ── Sticky "You" footer ── */}
        {me && (
          <View style={[styles.footer, { bottom: insets.bottom + FOOTER_BOTTOM_GAP }]}>
            <View style={[styles.miniAvatar, styles.miniAvatarMe, { width: 40, height: 40, borderRadius: 20 }]}>
              <Text style={[styles.miniAvatarLetter, { fontSize: 18 }]}>
                {me.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.footerName}>{me.name}</Text>
              {me.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={11} color="#888" />
                  <Text style={styles.footerLoc}>{me.location}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.footerPts}>{myScore.toLocaleString()} pts</Text>
            <View style={styles.footerRankBadge}>
              <Text style={styles.footerRankTxt}>#{myRank}</Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F3F7',
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#5F6368', marginTop: 12, fontSize: 14 },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '500', color: '#1F1F1F', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#5F6368', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#F2F3F7',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  headerSpacer: {
    width: 44,
  },
  emptyLogo: {
    width: 72,
    height: 72,
    opacity: 0.85,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#101010',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginLeft: 52,
    lineHeight: 20,
  },
  rankPill: {
    backgroundColor: 'rgba(230, 0, 0, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rankPillText: { fontSize: 14, fontWeight: '700', color: '#e60000' },

  scroll: { paddingTop: 4 },

  // Podium
  podiumWrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#fff',
    ...cardShadow,
  },
  podiumGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 36,
    paddingBottom: 24,
    gap: 6,
  },
  topCard: {
    width: (SCREEN_WIDTH - 44) / 3, // Fully responsive width
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardGold: { 
    height: 230, 
    borderColor: '#FFD700', 
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  cardSilver: { height: 190 },
  cardBronze: { height: 190 },
  topCardFirst: { transform: [{ scale: 1.06 }], zIndex: 2 },
  topCardMe: { borderColor: '#e60000', borderWidth: 1.5, backgroundColor: '#fffcfc' },

  rankBadge: {
    position: 'absolute',
    top: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  rankBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  crownLogo: {
    width: 28,
    height: 28,
    marginBottom: 4,
  },

  topAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  topAvatarLetter: { fontSize: 22, fontWeight: '800', color: '#555' },

  topName: { fontSize: 13, fontWeight: '700', color: '#111', textAlign: 'center' },
  topPoints: { fontSize: 15, fontWeight: '800', color: '#e60000', marginVertical: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  topLocation: { fontSize: 10, color: '#888', flexShrink: 1 },

  listCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingBottom: 8,
    overflow: 'hidden',
    ...cardShadow,
  },
  listSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },
  listSectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6368',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  listSectionLine: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginBottom: 4,
  },
  listHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listHeadTxt: {
    fontSize: 11,
    color: '#5F6368',
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginLeft: 52,
  },
  rowMe: { backgroundColor: '#FFF8F8' },

  rowRank: { width: 36, fontSize: 14, fontWeight: '500', color: '#1F1F1F' },
  rowUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarMe: { backgroundColor: '#FFE8E8' },
  miniAvatarLetter: { fontSize: 14, fontWeight: '500', color: '#5F6368' },
  rowName: { fontSize: 14, fontWeight: '500', color: '#1F1F1F', flex: 1 },
  rowPts: { width: 72, textAlign: 'right', fontSize: 14, fontWeight: '500', color: '#1F1F1F' },
  rowLocRow: { width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  rowLoc: { fontSize: 12, color: '#5F6368', flexShrink: 1, textAlign: 'right' },

  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  footerName: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  footerLoc: { fontSize: 12, color: '#5F6368' },
  footerPts: { fontSize: 16, fontWeight: '600', color: '#e60000', marginHorizontal: 12 },
  footerRankBadge: {
    backgroundColor: '#e60000',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  footerRankTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
});