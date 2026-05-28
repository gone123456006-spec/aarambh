import React, { memo, useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppUI } from '@/constants/theme';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SCENE = 280;
const ORBIT_R = 108;
const CUBE = 96;
const FACE_COUNT = 4;
const FACE_STEP = 360 / FACE_COUNT;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SPIRAL_DOTS = 150;
const SPIRAL_MAX_R = SCENE * 0.46;
const SPIRAL_ROTATION_MS = 12000;
const BOB_DURATION_MS = 2000;
const ORBIT_BOB = 10;
type SpiralDot = { x: number; y: number; size: number };

function buildSpiralDots(): SpiralDot[] {
  const dots: SpiralDot[] = [];
  const c = SPIRAL_MAX_R / Math.sqrt(SPIRAL_DOTS);
  for (let i = 0; i < SPIRAL_DOTS; i++) {
    const r = c * Math.sqrt(i + 1);
    const theta = (i + 1) * GOLDEN_ANGLE;
    const t = Math.min(r / SPIRAL_MAX_R, 1);
    dots.push({
      x: r * Math.cos(theta),
      y: r * Math.sin(theta),
      size: 1.8 + t * t * 8.5,
    });
  }
  return dots;
}

const SPIRAL_LAYOUT = buildSpiralDots();

type IconName = keyof typeof Ionicons.glyphMap;

/** Faces of a 3D cube — each shows a different learning/chat icon. */
const CUBE_FACES: { icon: IconName; color: string; gradient: [string, string] }[] = [
  { icon: 'chatbubbles', color: '#e60000', gradient: ['#ff6b6b', '#c40000'] },
  { icon: 'language', color: '#00b894', gradient: ['#34d399', '#059669'] },
  { icon: 'mic', color: '#3b82f6', gradient: ['#60a5fa', '#2563eb'] },
  { icon: 'book-outline', color: '#8b5cf6', gradient: ['#a78bfa', '#6d28d9'] },
];

/** Icons orbiting the center (kept minimal for smooth performance). */
const ORBIT_ICONS: { icon: IconName; color: string }[] = [
  { icon: 'language', color: '#00b894' },
  { icon: 'chatbubbles', color: '#e60000' },
  { icon: 'mic', color: '#3b82f6' },
  { icon: 'globe-outline', color: '#6366f1' },
  { icon: 'people', color: '#ef4444' },
];

const SpiralDotBubble = memo(function SpiralDotBubble({
  dot,
  index,
  bobPhase,
  center,
}: {
  dot: SpiralDot;
  index: number;
  bobPhase: SharedValue<number>;
  center: number;
}) {
  const bob = 2.5 + dot.size * 0.85;

  const style = useAnimatedStyle(() => {
    const offset = (index * 0.061) % 1;
    const t = (bobPhase.value + offset) % 1;
    const translateY = interpolate(
      t,
      [0, 0.25, 0.5, 0.75, 1],
      [bob * 0.35, -bob, -bob * 0.35, bob, bob * 0.35],
      Extrapolation.CLAMP
    );
    const scale = interpolate(t, [0, 0.5, 1], [0.94, 1.08, 0.94], Extrapolation.CLAMP);
    return { transform: [{ translateY }, { scale }] };
  });

  return (
    <Animated.View
      style={[
        styles.spiralDotWrap,
        {
          left: center + dot.x - dot.size / 2,
          top: center + dot.y - dot.size / 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.spiralDot,
          {
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            opacity: 0.42 + (dot.size / 10) * 0.58,
          },
        ]}
      />
    </Animated.View>
  );
});

/** Sunflower dot spiral — rotates and each dot bobs up/down. */
function DotSpiral({
  rotation,
  bobPhase,
}: {
  rotation: SharedValue<number>;
  bobPhase: SharedValue<number>;
}) {
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const center = SCENE / 2;

  return (
    <Animated.View style={[styles.spiralWrap, spinStyle]}>
      {SPIRAL_LAYOUT.map((dot, i) => (
        <SpiralDotBubble key={i} dot={dot} index={i} bobPhase={bobPhase} center={center} />
      ))}
    </Animated.View>
  );
}

function CarouselFace({
  index,
  icon,
  colors,
  spinY,
}: {
  index: number;
  icon: IconName;
  colors: [string, string];
  spinY: SharedValue<number>;
}) {
  const faceStyle = useAnimatedStyle(() => {
    const angle = (spinY.value + index * FACE_STEP) % 360;
    const rad = (angle * Math.PI) / 180;
    const depth = Math.cos(rad);
    const opacity = interpolate(depth, [-1, -0.25, 0.55, 1], [0, 0, 0.85, 1], Extrapolation.CLAMP);
    const scale = interpolate(depth, [-1, 1], [0.72, 1], Extrapolation.CLAMP);
    return {
      opacity,
      zIndex: depth > 0.3 ? 10 : 0,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[styles.cubeFace, faceStyle]}>
      <View style={[styles.facePanel, { backgroundColor: colors[0] }]}>
        <View style={[styles.facePanelInner, { backgroundColor: colors[1] }]} />
        <Ionicons name={icon} size={40} color="#fff" />
        <View style={styles.faceShine} />
      </View>
    </Animated.View>
  );
}

/** 3D-style icon carousel (rotateY/scale only — no translateZ). */
function RotatingIconCube({ spinY, tiltX }: { spinY: SharedValue<number>; tiltX: SharedValue<number> }) {
  const hubStyle = useAnimatedStyle(() => ({
    transform: [{ rotateX: `${tiltX.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.cubeStage, hubStyle]}>
      {CUBE_FACES.map((face, i) => (
        <CarouselFace
          key={face.icon}
          index={i}
          icon={face.icon}
          colors={face.gradient}
          spinY={spinY}
        />
      ))}
    </Animated.View>
  );
}

function OrbitSatellite({
  index,
  rotation,
  bobPhase,
  icon,
  color,
}: {
  index: number;
  rotation: SharedValue<number>;
  bobPhase: SharedValue<number>;
  icon: IconName;
  color: string;
}) {
  const count = ORBIT_ICONS.length;
  const step = 360 / count;
  const angle = (index * step * Math.PI) / 180;
  const x = Math.cos(angle) * ORBIT_R;
  const y = Math.sin(angle) * ORBIT_R;

  const uprightStyle = useAnimatedStyle(() => {
    const offset = index / count;
    const t = (bobPhase.value + offset) % 1;
    const translateY = interpolate(
      t,
      [0, 0.25, 0.5, 0.75, 1],
      [ORBIT_BOB * 0.3, -ORBIT_BOB, -ORBIT_BOB * 0.3, ORBIT_BOB, ORBIT_BOB * 0.3],
      Extrapolation.CLAMP
    );
    const scale = interpolate(t, [0, 0.5, 1], [0.92, 1.06, 0.92], Extrapolation.CLAMP);
    return {
      transform: [{ rotate: `${-rotation.value}deg` }, { translateY }, { scale }],
    };
  });

  return (
    <View
      style={[
        styles.orbitIconWrap,
        { transform: [{ translateX: x }, { translateY: y }] },
      ]}
    >
      <Animated.View style={uprightStyle}>
        <View style={[styles.orbitBubble, { backgroundColor: color }]}>
          <Ionicons name={icon} size={17} color="#fff" />
        </View>
      </Animated.View>
    </View>
  );
}

function OrbitRing({
  rotation,
  bobPhase,
}: {
  rotation: SharedValue<number>;
  bobPhase: SharedValue<number>;
}) {
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.orbitRing, ringStyle]}>
      {ORBIT_ICONS.map((item, i) => (
        <OrbitSatellite
          key={`${item.icon}-${i}`}
          index={i}
          rotation={rotation}
          bobPhase={bobPhase}
          icon={item.icon}
          color={item.color}
        />
      ))}
    </Animated.View>
  );
}

function AnimatedWaitDot({ index, phase }: { index: number; phase: SharedValue<number> }) {
  const dotStyle = useAnimatedStyle(() => {
    const offset = index * 0.22;
    const t = (phase.value + offset) % 1;
    const opacity = interpolate(t, [0, 0.45, 1], [0.22, 1, 0.22], Extrapolation.CLAMP);
    return { opacity };
  });

  return <Animated.Text style={[styles.findingSub, styles.waitDot, dotStyle]}>.</Animated.Text>;
}

function PleaseWaitLabel() {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );
  }, [phase]);

  return (
    <View style={styles.waitRow}>
      <Text style={styles.findingSub}>Please wait</Text>
      <AnimatedWaitDot index={0} phase={phase} />
      <AnimatedWaitDot index={1} phase={phase} />
      <AnimatedWaitDot index={2} phase={phase} />
    </View>
  );
}

function MatchmakingFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.findingTitle}>Finding Your Learner</Text>
      <PleaseWaitLabel />
    </View>
  );
}

export function MatchmakingScene() {
  const spiralSpin = useSharedValue(0);
  const bobPhase = useSharedValue(0);
  const orbitSpin = useSharedValue(0);
  const cubeSpinY = useSharedValue(0);
  const cubeTiltX = useSharedValue(14);
  useEffect(() => {
    bobPhase.value = withRepeat(
      withTiming(1, { duration: BOB_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );

    spiralSpin.value = withRepeat(
      withTiming(360, { duration: SPIRAL_ROTATION_MS, easing: Easing.linear }),
      -1,
      false
    );

    orbitSpin.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1,
      false
    );

    cubeSpinY.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );

    cubeTiltX.value = withRepeat(
      withTiming(12, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

  }, [spiralSpin, bobPhase, orbitSpin, cubeSpinY, cubeTiltX]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.scene}>
        <DotSpiral rotation={spiralSpin} bobPhase={bobPhase} />

        <OrbitRing rotation={orbitSpin} bobPhase={bobPhase} />

        <View style={styles.cubeAnchor}>
          <RotatingIconCube spinY={cubeSpinY} tiltX={cubeTiltX} />
        </View>
      </View>

      <MatchmakingFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: AppUI.bg,
  },
  scene: {
    width: SCENE,
    height: SCENE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  spiralWrap: {
    position: 'absolute',
    width: SCENE,
    height: SCENE,
    zIndex: 0,
  },
  spiralDotWrap: {
    position: 'absolute',
  },
  spiralDot: {
    backgroundColor: AppUI.accent,
  },
  orbitRing: {
    position: 'absolute',
    width: SCENE,
    height: SCENE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  orbitIconWrap: {
    position: 'absolute',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: AppUI.surface,
    ...Platform.select({
      ios: {
        shadowColor: AppUI.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cubeAnchor: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeStage: {
    width: CUBE,
    height: CUBE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeFace: {
    position: 'absolute',
    width: CUBE,
    height: CUBE,
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  facePanel: {
    width: CUBE,
    height: CUBE,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    ...Platform.select({
      ios: {
        shadowColor: AppUI.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  facePanelInner: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  faceShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  findingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppUI.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  findingSub: {
    fontSize: 15,
    fontWeight: '500',
    color: AppUI.textSecondary,
    lineHeight: 22,
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  waitDot: {
    marginLeft: 1,
    marginBottom: -1,
  },
});
