import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { getDailyWordForToday } from '@/constants/dailyWords';
import { Icons3D } from '@/constants/homeIcons';
import { DAILY_WORD_POINTS } from '@/utils/dailyWordRewards';
import { useDailyRewardClaimed } from '@/hooks/use-daily-reward-claimed';
import { AppUI } from '@/constants/theme';

const WORD_TEXTURE = [
  { kind: '3d' as const, source: Icons3D.pencil, size: 32, top: 8, left: 10, rotate: '-12deg', opacity: 0.18 },
  { kind: '3d' as const, source: Icons3D.cards, size: 30, top: 6, right: 14, rotate: '10deg', opacity: 0.16 },
  { kind: '3d' as const, source: Icons3D.graduationCap, size: 34, bottom: 10, left: 24, rotate: '8deg', opacity: 0.15 },
  { kind: '3d' as const, source: Icons3D.help, size: 28, bottom: 12, right: 36, rotate: '-6deg', opacity: 0.14 },
  { kind: 'icon' as const, name: 'library-outline' as const, size: 24, top: 36, right: 8, rotate: '6deg', opacity: 0.13, color: '#6366F1' },
  { kind: 'icon' as const, name: 'text-outline' as const, size: 22, bottom: 18, right: 10, rotate: '-8deg', opacity: 0.12, color: '#8B5CF6' },
  { kind: 'icon' as const, name: 'create-outline' as const, size: 20, top: 14, left: 52, rotate: '4deg', opacity: 0.12, color: '#4F46E5' },
];

type WordTextureItem = (typeof WORD_TEXTURE)[number];

const WordTextureIcon = memo(function WordTextureIcon({
  item,
  index,
}: {
  item: WordTextureItem;
  index: number;
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, {
        duration: 2600 + index * 300,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [float, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [2, -4 - (index % 2) * 2]) },
      { scale: interpolate(float.value, [0, 0.5, 1], [0.98, 1.03, 0.98]) },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: item.top,
        left: item.left,
        right: item.right,
        bottom: item.bottom,
        opacity: item.opacity,
        transform: [{ rotate: item.rotate }],
      }}
    >
      <Animated.View style={animatedStyle}>
        {item.kind === '3d' ? (
          <Image
            source={item.source}
            style={{ width: item.size, height: item.size }}
            resizeMode="contain"
          />
        ) : (
          <Ionicons name={item.name} size={item.size} color={item.color} />
        )}
      </Animated.View>
    </View>
  );
});

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
      <LinearGradient
        colors={['#EDE9FE', '#E0E7FF', '#F0F9FF']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.decorCircle} pointerEvents="none" />
        <View style={styles.textureLayer} pointerEvents="none">
          {WORD_TEXTURE.map((item, index) => (
            <WordTextureIcon key={`word-texture-${index}`} item={item} index={index} />
          ))}
        </View>

        <View style={styles.contentRow}>
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
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    width: '100%',
  },
  gradient: {
    minHeight: 118,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  decorCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -30,
    right: 20,
  },
  textureLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
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
