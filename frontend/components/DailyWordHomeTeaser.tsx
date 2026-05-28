import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getDailyWordForToday } from '@/constants/dailyWords';
import { DAILY_WORD_POINTS } from '@/utils/dailyWordRewards';
import { useDailyRewardClaimed } from '@/hooks/use-daily-reward-claimed';
import { AppUI } from '@/constants/theme';

export default function DailyWordHomeTeaser() {
  const router = useRouter();
  const word = getDailyWordForToday();
  const { unclaimed } = useDailyRewardClaimed();

  return (
    <TouchableOpacity
      style={styles.wrap}
      activeOpacity={0.88}
      onPress={() => router.push('/(tabs)/rewards')}
    >
      <View style={styles.left}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Word of the Day</Text>
          {unclaimed ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.word}>{word.word}</Text>
        <Text style={[styles.hint, unclaimed && styles.hintUnclaimed]}>
          {unclaimed
            ? `Reward waiting — claim +${DAILY_WORD_POINTS} pts in Rewards`
            : 'Reward claimed — tap to review'}
        </Text>
      </View>
      <View style={styles.right}>
        {unclaimed ? (
          <View style={styles.rewardIndicator}>
            <View style={styles.indicatorDot} />
            <Text style={styles.indicatorText}>New</Text>
          </View>
        ) : (
          <Feather name="check-circle" size={22} color="#2E7D32" />
        )}
        <Feather name="chevron-right" size={22} color="#9AA0A6" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppUI.divider,
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heading: {
    fontSize: 16,
    color: AppUI.text,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppUI.accent,
  },
  word: {
    fontSize: 28,
    fontWeight: '600',
    color: AppUI.text,
    letterSpacing: -0.3,
  },
  hint: {
    fontSize: 13,
    color: AppUI.textSecondary,
    fontWeight: '500',
    marginTop: 6,
  },
  hintUnclaimed: {
    color: AppUI.accent,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AppUI.accentGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppUI.accent,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppUI.accent,
  },
});
