import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { hasClaimedDailyWordToday, subscribeDailyRewardStatus } from '@/utils/dailyWordRewards';

/** Tracks whether today's daily word reward was claimed; refreshes on tab focus / navigation. */
export function useDailyRewardClaimed() {
  const navigation = useNavigation();
  const [claimed, setClaimed] = useState(true);

  const refresh = useCallback(async () => {
    setClaimed(await hasClaimedDailyWordToday());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const unsubNav = navigation.addListener('state', () => {
      refresh();
    });
    const unsubReward = subscribeDailyRewardStatus(refresh);
    refresh();
    return () => {
      unsubNav();
      unsubReward();
    };
  }, [navigation, refresh]);

  return { claimed, unclaimed: !claimed, refresh };
}
