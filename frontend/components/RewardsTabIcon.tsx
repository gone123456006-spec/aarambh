import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDailyRewardClaimed } from '@/hooks/use-daily-reward-claimed';

type Props = {
  color: string;
  size?: number;
};

export function RewardsTabIcon({ color, size = 28 }: Props) {
  const { unclaimed } = useDailyRewardClaimed();

  return (
    <View style={styles.wrap}>
      <IconSymbol size={size} name="gift.fill" color={color} />
      {unclaimed ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#e60000',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
