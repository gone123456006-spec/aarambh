import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
  StatusBar,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter, useFocusEffect } from 'expo-router';
import DailyWordCard from '@/components/DailyWordCard';
import { DAILY_WORD_TOTAL_DAYS } from '@/constants/dailyWords';
import {
  DAILY_WORD_POINTS,
  JOURNEY_COMPLETION_BONUS,
  getDailyWordCompletedCount,
  hasClaimedDailyWordToday,
  hasReceivedJourneyBonus,
} from '@/utils/dailyWordRewards';
import { getTotalGameScore } from '@/utils/gameStats';

/** Samsung One UI–inspired palette (neutral surfaces + app accent) */
const UI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FA',
  text: '#101010',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#e60000',
  accentDark: '#c40000',
  accentGlow: 'rgba(230, 0, 0, 0.12)',
  blue: '#1B6EF3',
  blueSoft: '#E8F1FE',
  green: '#12B76A',
  greenSoft: '#ECFDF3',
  divider: 'rgba(0,0,0,0.06)',
  shadow: '#000000',
};

function SectionLabel({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function StatTile({
  icon,
  iconBg,
  label,
  value,
  hint,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statTileIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={UI.text} />
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={styles.statTileValue}>{value}</Text>
      {hint ? <Text style={styles.statTileHint}>{hint}</Text> : null}
    </View>
  );
}

export default function RewardsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [totalScore, setTotalScore] = useState(0);
  const [claimedToday, setClaimedToday] = useState(false);
  const [completedDays, setCompletedDays] = useState(0);
  const [journeyBonusReceived, setJourneyBonusReceived] = useState(false);

  const progressPct = Math.min(
    100,
    Math.round((completedDays / DAILY_WORD_TOTAL_DAYS) * 100)
  );
  const daysLeft = Math.max(0, DAILY_WORD_TOTAL_DAYS - completedDays);

  const refresh = useCallback(async () => {
    const [score, claimed, completed, bonusDone] = await Promise.all([
      getTotalGameScore(),
      hasClaimedDailyWordToday(),
      getDailyWordCompletedCount(),
      hasReceivedJourneyBonus(),
    ]);
    setTotalScore(score);
    setClaimedToday(claimed);
    setCompletedDays(completed);
    setJourneyBonusReceived(bonusDone);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={UI.bg} />
      <SafeAreaView edges={['top']} style={styles.safeTop} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 28 }]}
      >
        <Text style={styles.pageTitle}>Rewards</Text>
        <Text style={styles.pageSubtitle}>Earn points daily and complete your vocabulary journey</Text>

        {/* Hero — Samsung-style summary widget */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF8F8', '#FFEFEF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroEyebrow}>Your balance</Text>
                <View style={styles.heroPointsRow}>
                  <Text style={styles.heroPoints}>{totalScore.toLocaleString()}</Text>
                  <Text style={styles.heroPointsUnit}>pts</Text>
                </View>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="trophy" size={28} color={UI.accent} />
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroFooter}>
              <View style={styles.heroFooterItem}>
                <Text style={styles.heroFooterLabel}>Today</Text>
                <Text style={[styles.heroFooterValue, claimedToday && styles.heroFooterDone]}>
                  {claimedToday ? 'Claimed' : `+${DAILY_WORD_POINTS} available`}
                </Text>
              </View>
              <View style={styles.heroFooterDivider} />
              <View style={styles.heroFooterItem}>
                <Text style={styles.heroFooterLabel}>Journey bonus</Text>
                <Text style={styles.heroFooterValue}>
                  {journeyBonusReceived ? 'Unlocked' : `${JOURNEY_COMPLETION_BONUS} pts`}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick stats row */}
        <View style={styles.statRow}>
          <StatTile
            icon="calendar"
            iconBg={UI.blueSoft}
            label="Streak progress"
            value={`${completedDays} days`}
            hint={`${daysLeft} left`}
          />
          <StatTile
            icon={claimedToday ? 'check-circle' : 'gift'}
            iconBg={claimedToday ? UI.greenSoft : UI.accentGlow}
            label="Daily word"
            value={claimedToday ? 'Complete' : 'Pending'}
            hint={claimedToday ? 'See you tomorrow' : `+${DAILY_WORD_POINTS} pts`}
          />
        </View>

        {/* Journey card */}
        <SectionLabel title="100-day journey" action={`${progressPct}%`} />
        <View style={styles.journeyCard}>
          <View style={styles.journeyTop}>
            <View style={styles.journeyRingOuter}>
              <View style={styles.journeyRingTrack} />
              <View
                style={[
                  styles.journeyRingFill,
                  {
                    width: `${Math.max(progressPct, 4)}%`,
                  },
                ]}
              />
              <View style={styles.journeyRingCenter}>
                <Text style={styles.journeyRingPct}>{progressPct}%</Text>
                <Text style={styles.journeyRingSub}>done</Text>
              </View>
            </View>
            <View style={styles.journeyCopy}>
              <Text style={styles.journeyTitle}>
                {journeyBonusReceived ? 'Journey complete' : 'Keep learning daily'}
              </Text>
              <Text style={styles.journeyDesc}>
                {journeyBonusReceived
                  ? `You earned the ${JOURNEY_COMPLETION_BONUS.toLocaleString()} point bonus.`
                  : `Complete ${DAILY_WORD_TOTAL_DAYS} days to unlock ${JOURNEY_COMPLETION_BONUS.toLocaleString()} bonus points.`}
              </Text>
              <Text style={styles.journeyMeta}>
                {completedDays} / {DAILY_WORD_TOTAL_DAYS} days
              </Text>
            </View>
          </View>
          <View style={styles.journeyBarTrack}>
            <LinearGradient
              colors={[UI.accent, '#ff5a5a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.journeyBarFill, { width: `${progressPct}%` }]}
            />
          </View>
        </View>

        {/* Today's word */}
        <SectionLabel title="Today's challenge" />
        <DailyWordCard onClaimSuccess={refresh} />

        {/* Quick links — Samsung settings–style list */}
        <SectionLabel title="More" />
        <View style={styles.listGroup}>
          <Pressable
            style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
            onPress={() => router.push('/leaderboard')}
          >
            <View style={[styles.listIcon, { backgroundColor: UI.blueSoft }]}>
              <Feather name="bar-chart-2" size={20} color={UI.blue} />
            </View>
            <View style={styles.listText}>
              <Text style={styles.listTitle}>Leaderboard</Text>
              <Text style={styles.listSub}>Compare your score with other learners</Text>
            </View>
            <Feather name="chevron-right" size={22} color={UI.textTertiary} />
          </Pressable>

          <View style={styles.listSeparator} />

          <Pressable
            style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
            onPress={() => router.push('/(tabs)/courses')}
          >
            <View style={[styles.listIcon, { backgroundColor: UI.surfaceMuted }]}>
              <Feather name="book-open" size={20} color={UI.textSecondary} />
            </View>
            <View style={styles.listText}>
              <Text style={styles.listTitle}>Courses</Text>
              <Text style={styles.listSub}>Continue lessons and earn more points</Text>
            </View>
            <Feather name="chevron-right" size={22} color={UI.textTertiary} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  safeTop: {
    backgroundColor: UI.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: UI.textSecondary,
    marginTop: 6,
    marginBottom: 20,
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    ...cardShadow,
  },
  heroGradient: {
    padding: 22,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.textSecondary,
    letterSpacing: 0.2,
  },
  heroPointsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
    gap: 6,
  },
  heroPoints: {
    fontSize: 44,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -1.5,
  },
  heroPointsUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: UI.textSecondary,
    marginBottom: 8,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: UI.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: UI.divider,
    marginVertical: 18,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroFooterItem: {
    flex: 1,
  },
  heroFooterDivider: {
    width: 1,
    height: 36,
    backgroundColor: UI.divider,
    marginHorizontal: 16,
  },
  heroFooterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: UI.textTertiary,
    marginBottom: 4,
  },
  heroFooterValue: {
    fontSize: 15,
    fontWeight: '600',
    color: UI.text,
  },
  heroFooterDone: {
    color: UI.green,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statTile: {
    flex: 1,
    backgroundColor: UI.surface,
    borderRadius: 22,
    padding: 16,
    ...cardShadow,
  },
  statTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statTileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: UI.textTertiary,
  },
  statTileValue: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.text,
    marginTop: 2,
  },
  statTileHint: {
    fontSize: 11,
    color: UI.textSecondary,
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: 15,
    fontWeight: '600',
    color: UI.accent,
  },
  journeyCard: {
    backgroundColor: UI.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    ...cardShadow,
  },
  journeyTop: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 16,
  },
  journeyRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: UI.surfaceMuted,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyRingTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    borderWidth: 6,
    borderColor: '#E5E7EB',
  },
  journeyRingFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: UI.accentGlow,
    borderTopRightRadius: 44,
    borderBottomRightRadius: 44,
  },
  journeyRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyRingPct: {
    fontSize: 20,
    fontWeight: '700',
    color: UI.accent,
  },
  journeyRingSub: {
    fontSize: 11,
    fontWeight: '500',
    color: UI.textTertiary,
    marginTop: -2,
  },
  journeyCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  journeyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI.text,
    marginBottom: 6,
  },
  journeyDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: UI.textSecondary,
  },
  journeyMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.accent,
    marginTop: 10,
  },
  journeyBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECEEF2',
    overflow: 'hidden',
  },
  journeyBarFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 8,
  },
  listGroup: {
    backgroundColor: UI.surface,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 8,
    ...cardShadow,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  listRowPressed: {
    backgroundColor: UI.surfaceMuted,
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listText: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI.text,
  },
  listSub: {
    fontSize: 13,
    color: UI.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  listSeparator: {
    height: 1,
    backgroundColor: UI.divider,
    marginLeft: 76,
  },
});
