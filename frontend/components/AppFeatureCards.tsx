import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { FeatureCardImages } from '@/constants/featureCardImages';
import { AppUI } from '@/constants/theme';

type FeatureCard = {
  id: string;
  title: string;
  description: string;
  image: number;
  route: string;
};

const FEATURES: FeatureCard[] = [
  {
    id: 'chat',
    title: 'Chat with learners',
    description: 'Practice spoken English live with students across India.',
    image: FeatureCardImages.chat,
    route: '/random-chat',
  },
  {
    id: 'courses',
    title: 'Video lessons',
    description: 'Beginner to advanced courses with lectures and PDF notes.',
    image: FeatureCardImages.courses,
    route: '/(tabs)/my-courses',
  },
  {
    id: 'games',
    title: 'English games',
    description: 'Quiz, word puzzles and flashcards to build vocabulary.',
    image: FeatureCardImages.games,
    route: '/(tabs)/courses',
  },
  {
    id: 'vocabulary',
    title: 'Daily vocabulary',
    description: 'Learn a new word every day and collect reward points.',
    image: FeatureCardImages.vocabulary,
    route: '/(tabs)/rewards',
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    description: 'See how you rank against other learners in your class.',
    image: FeatureCardImages.leaderboard,
    route: '/leaderboard',
  },
  {
    id: 'performance',
    title: 'Your progress',
    description: 'Track course completion, game scores and accuracy.',
    image: FeatureCardImages.progress,
    route: '/performance',
  },
];

const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;
const ACTIVE_SCALE = 1.06;
const INACTIVE_SCALE = 0.9;
const ACTIVE_LIFT = -8;
const INACTIVE_DROP = 10;

type CarouselCardProps = {
  item: FeatureCard;
  index: number;
  cardWidth: number;
  snapInterval: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
};

function FeatureCarouselCard({
  item,
  index,
  cardWidth,
  snapInterval,
  scrollX,
  onPress,
}: CarouselCardProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const centerOffset = index * snapInterval;
    const inputRange = [
      centerOffset - snapInterval,
      centerOffset,
      centerOffset + snapInterval,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [INACTIVE_SCALE, ACTIVE_SCALE, INACTIVE_SCALE],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [INACTIVE_DROP, ACTIVE_LIFT, INACTIVE_DROP],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.78, 1, 0.78],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <Animated.View style={[styles.cardShell, { width: cardWidth }, animatedStyle]}>
      <TouchableOpacity
        style={[styles.card, { width: cardWidth }]}
        activeOpacity={0.92}
        onPress={onPress}
      >
        <View style={styles.cardVisual}>
          <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>Open</Text>
            <Feather name="arrow-right" size={14} color={AppUI.accent} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AppFeatureCards() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(272, Math.round(screenWidth * 0.74));
  const snapInterval = cardWidth + CARD_GAP;
  const sideInset = Math.max(HORIZONTAL_PADDING, (screenWidth - cardWidth) / 2);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <View style={[styles.section, { paddingBottom: tabBarHeight + 28 }]}>
      <View style={styles.gradientClip}>
        <LinearGradient
          colors={['#9EC5E8', '#6BA3D4', '#4578A8']}
          locations={[0, 0.48, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.sectionContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Explore <Text style={styles.sectionTitleAccent}>more</Text>
          </Text>
          <View style={styles.sectionTitleDots}>
            <View style={styles.sectionTitleDot} />
            <View style={styles.sectionTitleDot} />
            <View style={styles.sectionTitleDot} />
          </View>
        </View>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={snapInterval}
          snapToAlignment="start"
          disableIntervalMomentum
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: sideInset,
              gap: CARD_GAP,
            },
          ]}
          style={styles.carousel}
        >
          {FEATURES.map((item, index) => (
            <FeatureCarouselCard
              key={item.id}
              item={item}
              index={index}
              cardWidth={cardWidth}
              snapInterval={snapInterval}
              scrollX={scrollX}
              onPress={() => router.push(item.route as never)}
            />
          ))}
        </Animated.ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    paddingTop: 24,
    flexGrow: 1,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  gradientClip: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sectionContent: {
    zIndex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(15, 40, 70, 0.22)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      },
      android: {},
      default: {},
    }),
  },
  sectionTitleAccent: {
    fontWeight: '800',
    color: '#FFFBEB',
  },
  sectionTitleDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  sectionTitleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  carousel: {
    overflow: 'visible',
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 22,
    alignItems: 'flex-start',
  },
  cardShell: {
    overflow: 'visible',
  },
  card: {
    backgroundColor: AppUI.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppUI.divider,
    ...Platform.select({
      ios: {
        shadowColor: AppUI.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardVisual: {
    height: 172,
    backgroundColor: AppUI.surfaceMuted,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppUI.text,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: AppUI.textSecondary,
    fontWeight: '500',
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppUI.accent,
  },
});
