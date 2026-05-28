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

const DOT_SIZE = 5;
const DOT_COLOR = '#8696a0';
const BUBBLE_PEER_BG = '#d9f5d0';

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

/** Compact “thinking” typing indicator (pulsing dots). */
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
    marginBottom: 4,
    marginTop: 2,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: BUBBLE_PEER_BG,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderTopLeftRadius: 2,
    minHeight: 28,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
  },
});
