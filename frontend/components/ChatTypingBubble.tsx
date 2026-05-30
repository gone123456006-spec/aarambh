import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { AppUI, cardShadow } from '@/constants/theme';

const DOT_SIZE = 5;

function ThinkingDot({ delay }: { delay: number }) {
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    const pulse = withRepeat(
      withSequence(
        withTiming(1, { duration: 360 }),
        withTiming(0.55, { duration: 360 })
      ),
      -1,
      false
    );
    scale.value = withDelay(delay, pulse);
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360 }),
          withTiming(0.35, { duration: 360 })
        ),
        -1,
        false
      )
    );
  }, [delay, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

/** Compact typing indicator — Samsung One UI bubble style. */
export function ChatTypingBubble() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bubble}>
        <ThinkingDot delay={0} />
        <ThinkingDot delay={140} />
        <ThinkingDot delay={280} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppUI.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    minHeight: 32,
    ...cardShadow,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: AppUI.textTertiary,
  },
});
