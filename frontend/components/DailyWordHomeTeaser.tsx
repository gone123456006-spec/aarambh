import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
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

/** Decorative icons — kept on the left/middle so the right action column never overflows. */
const WORD_TEXTURE = [
  { kind: '3d' as const, source: Icons3D.pencil, size: 28, top: 8, left: 8, rotate: '-12deg', opacity: 0.16 },
  { kind: '3d' as const, source: Icons3D.graduationCap, size: 30, top: 4, left: 52, rotate: '8deg', opacity: 0.14 },
  { kind: '3d' as const, source: Icons3D.cards, size: 26, bottom: 10, left: 18, rotate: '10deg', opacity: 0.14 },
  { kind: '3d' as const, source: Icons3D.help, size: 24, bottom: 8, left: 88, rotate: '-6deg', opacity: 0.12 },
  { kind: 'icon' as const, name: 'library-outline' as const, size: 22, top: 34, left: 118, rotate: '6deg', opacity: 0.11, color: '#6366F1' },
  { kind: 'icon' as const, name: 'create-outline' as const, size: 18, top: 12, left: 34, rotate: '4deg', opacity: 0.11, color: '#4F46E5' },
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
  const { width: screenWidth } = useWindowDimensions();
  const word = getDailyWordForToday();
  const { unclaimed } = useDailyRewardClaimed();
  const compact = screenWidth < 380;
  const hintText = unclaimed
    ? `Reward waiting — claim +${DAILY_WORD_POINTS} pts in Rewards`
    : 'Reward claimed — tap to review';

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
        style={[styles.gradient, compact && styles.gradientCompact]}
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
              <Text style={[styles.heading, compact && styles.headingCompact]} numberOfLines={1}>
                Word of the Day
              </Text>
              {unclaimed ? <View style={styles.dot} /> : null}
            </View>
            <Text
              style={[styles.word, compact && styles.wordCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {word.word}
            </Text>
            <Text
              style={[styles.hint, unclaimed && styles.hintUnclaimed, compact && styles.hintCompact]}
              numberOfLines={2}
            >
              {hintText}
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
    overflow: 'hidden',
  },
  gradient: {
    minHeight: 118,
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  gradientCompact: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 112,
  },
  decorCircle: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -28,
    left: -18,
  },
  textureLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    right: 72,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  left: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
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
    flexShrink: 1,
  },
  headingCompact: {
    fontSize: 15,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppUI.accent,
    flexShrink: 0,
  },
  word: {
    fontSize: 28,
    fontWeight: '600',
    color: AppUI.text,
    letterSpacing: -0.3,
  },
  wordCompact: {
    fontSize: 24,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: AppUI.textSecondary,
    fontWeight: '500',
    marginTop: 6,
    flexShrink: 1,
  },
  hintCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  hintUnclaimed: {
    color: AppUI.accent,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginLeft: 4,
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
