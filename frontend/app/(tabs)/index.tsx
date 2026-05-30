import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import Sidebar from '@/components/Sidebar';
import { HomeMenuIcon } from '@/components/HomeHeaderIcons';
import DailyWordHomeTeaser from '@/components/DailyWordHomeTeaser';
import AppFeatureCards from '@/components/AppFeatureCards';
import ResponsiveContent from '@/components/ResponsiveContent';
import { getHomeBannerLayout } from '@/utils/homeBannerLayout';
import { getAndroidHeaderCompactStyle } from '@/utils/safeAreaInsets';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { APP_INFO, phoneTelUri } from '@/constants/appInfo';
import { AppUI, cardShadow } from '@/constants/theme';

import { Icons3D } from '@/constants/homeIcons';

const BANNER_33_IMAGE = require('../../assets/images/banner iamge 33.png');
const BANNER_HERO_2_2_IMAGE = require('../../assets/images/banner iamge hero 2 2.png');
const BANNER_44_IMAGE = require('../../assets/images/iagme banner 44 .png');
const BANNER_RANDOM_CHAT_IMAGE = require('../../assets/images/Banner Iamge 1 .jpeg');

type HomeBanner = {
  id: number;
  image: number;
  route?: '/courses';
};

const BANNERS: HomeBanner[] = [
  {
    id: 1,
    image: BANNER_33_IMAGE,
  },
  {
    id: 2,
    image: BANNER_HERO_2_2_IMAGE,
  },
  {
    id: 3,
    image: BANNER_44_IMAGE,
  },
  {
    id: 4,
    image: BANNER_RANDOM_CHAT_IMAGE,
    route: '/courses',
  },
];

const QUICK_ACTIONS = [
  { id: 1, title: 'Leaderboard', image: Icons3D.trophy, bg: '#FFF5F5', route: '/leaderboard' as const },
  { id: 2, title: 'Performance', image: Icons3D.comboChart, bg: '#FFF9F0', route: '/performance' as const },
];

const LEARNING_ACTIONS = [
  {
    id: 1,
    title: 'Chat in English',
    image: Icons3D.speechBubble,
    bg: '#F3F0FF',
    desc: 'Chat with real learners live',
  },
  {
    id: 2,
    title: 'Call in English',
    image: Icons3D.phone,
    bg: '#EBFBEE',
    desc: 'Build confidence with voice calls',
  },
  {
    id: 3,
    title: 'Group Discussion',
    image: Icons3D.conferenceCall,
    bg: '#E1F5FE',
    desc: 'Practice speaking in small groups',
  },
];

const COMMUNITY_AD = {
  faces: [
    require('../../assets/images/intro1.png'),
    require('../../assets/images/intro2.png'),
    require('../../assets/images/intro3.png'),
  ],
  hero: require('../../assets/images/intro4.png'),
};

const GREETING_TEXTURE = [
  { kind: '3d' as const, source: Icons3D.speechBubble, size: 38, top: 6, left: 8, rotate: '-14deg', opacity: 0.2 },
  { kind: '3d' as const, source: Icons3D.graduationCap, size: 34, top: 4, right: 10, rotate: '12deg', opacity: 0.18 },
  { kind: '3d' as const, source: Icons3D.pencil, size: 30, top: 52, left: 28, rotate: '-8deg', opacity: 0.16 },
  { kind: '3d' as const, source: Icons3D.cards, size: 32, top: 48, right: 24, rotate: '10deg', opacity: 0.17 },
  { kind: '3d' as const, source: Icons3D.seedling, size: 28, bottom: 8, left: 48, rotate: '6deg', opacity: 0.15 },
  { kind: 'icon' as const, name: 'book-outline' as const, size: 26, top: 28, right: 52, rotate: '-6deg', opacity: 0.14, color: '#6366F1' },
  { kind: 'icon' as const, name: 'language-outline' as const, size: 24, bottom: 10, right: 12, rotate: '8deg', opacity: 0.14, color: '#8B5CF6' },
  { kind: 'icon' as const, name: 'mic-outline' as const, size: 22, bottom: 14, left: 12, rotate: '-10deg', opacity: 0.13, color: '#4F46E5' },
];

export default function HomeScreen() {
  const { width: screenWidth, contentWidth, isTablet } = useResponsiveLayout();
  const bannerLayout = getHomeBannerLayout(screenWidth);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [userName, setUserName] = useState('User');
  const [userLevel, setUserLevel] = useState('Beginner');
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = activeBannerIndex + 1;
      if (nextIndex >= BANNERS.length) {
        nextIndex = 0;
      }
      scrollViewRef.current?.scrollTo({
        x: nextIndex * bannerLayout.slideWidth,
        animated: true,
      });
      setActiveBannerIndex(nextIndex);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeBannerIndex, bannerLayout.slideWidth]);

  const loadUserHeader = useCallback(async () => {
    try {
      const [storedName, storedLevel] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEYS.userName),
        AsyncStorage.getItem(AUTH_KEYS.level),
      ]);
      if (storedName?.trim()) {
        setUserName(storedName.trim().split(' ')[0]);
      } else {
        setUserName('User');
      }
      setUserLevel(storedLevel?.trim() || 'Beginner');
    } catch (e) {
      console.error('Failed to load user header', e);
    }
  }, []);

  useEffect(() => {
    loadUserHeader();
  }, [loadUserHeader]);

  useFocusEffect(
    useCallback(() => {
      loadUserHeader();
    }, [loadUserHeader])
  );

  const headerPillLabel = /^\d+$/.test(userLevel)
    ? `Class ${userLevel} competitive`
    : `${userLevel} competitive`;

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const timeGreeting = getTimeGreeting();

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={AppUI.homeHeroGradient[0]}
        translucent={Platform.OS === 'android'}
      />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
      <ResponsiveContent>
      <View style={[styles.stickyHeaderWrap, getAndroidHeaderCompactStyle()]}>
        <View style={[styles.stickyHeader, isTablet && { maxWidth: contentWidth, alignSelf: 'center', width: '100%' }]}>
        <TouchableOpacity
          style={styles.headerMenuBtn}
          onPress={() => setSidebarVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Open menu"
        >
          <HomeMenuIcon />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenterPill}
          onPress={() => router.push('/profile')}
          activeOpacity={0.88}
          accessibilityLabel="Open profile"
        >
          <View style={styles.pillAvatar}>
            <Feather name="user" size={13} color={AppUI.textTertiary} />
          </View>
          <Text style={styles.pillLabel} numberOfLines={1}>
            {headerPillLabel}
          </Text>
          <Feather name="chevron-down" size={15} color="#1A202C" />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.navigate('/(tabs)/ved')}
            activeOpacity={0.88}
            style={styles.headerIconBtn}
            accessibilityLabel="Open support"
          >
            <Feather name="search" size={22} color={AppUI.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={async () => {
              try {
                await Linking.openURL(phoneTelUri());
              } catch {
                Alert.alert('Unable to call', `Please dial +91 ${APP_INFO.mobile}`);
              }
            }}
            hitSlop={8}
            accessibilityLabel={`Call +91 ${APP_INFO.mobile}`}
          >
            <Feather name="phone" size={22} color={AppUI.text} />
          </TouchableOpacity>
        </View>
      </View>
      </View>
      </ResponsiveContent>
      </SafeAreaView>

      <SafeAreaView style={styles.safeFill} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section 1 — banner, greeting, Chat with Random */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[...AppUI.homeHeroGradient]}
            locations={[...AppUI.homeHeroGradientLocations]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Main Banner Sliding Section */}
          <View>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const index = Math.round(x / bannerLayout.slideWidth);
                setActiveBannerIndex(index);
              }}
            >
              {BANNERS.map((banner) => {
                const cardBody = (
                  <View
                    style={[
                      styles.bannerContainer,
                      cardShadow,
                      {
                        width: bannerLayout.cardWidth,
                        marginLeft: bannerLayout.cardOffsetX,
                      },
                    ]}
                  >
                    <Image
                      source={banner.image}
                      style={[
                        styles.bannerImage,
                        { height: bannerLayout.gradientHeight },
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                );

                return (
                  <View
                    key={banner.id}
                    style={{
                      width: bannerLayout.slideWidth,
                      paddingTop: 12,
                      paddingBottom: 12,
                    }}
                  >
                    {banner.route ? (
                      <TouchableOpacity
                        activeOpacity={0.92}
                        onPress={() => router.push(banner.route)}
                      >
                        {cardBody}
                      </TouchableOpacity>
                    ) : (
                      cardBody
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Pagination Dots */}
            <View style={styles.pagination}>
              {BANNERS.map((_, index) => (
                <View key={index} style={[styles.dot, activeBannerIndex === index && styles.activeDot]} />
              ))}
            </View>
          </View>

          {/* Greeting — plain text, no card */}
          <View style={styles.greetingContainer}>
            <View style={styles.greetingTexture} pointerEvents="none">
              {GREETING_TEXTURE.map((item, index) => {
                const layout = {
                  position: 'absolute' as const,
                  top: item.top,
                  left: item.left,
                  right: item.right,
                  bottom: item.bottom,
                  opacity: item.opacity,
                  transform: [{ rotate: item.rotate }],
                };

                if (item.kind === '3d') {
                  return (
                    <Image
                      key={`greeting-texture-${index}`}
                      source={item.source}
                      style={[layout, { width: item.size, height: item.size }]}
                      resizeMode="contain"
                    />
                  );
                }

                return (
                  <Ionicons
                    key={`greeting-texture-${index}`}
                    name={item.name}
                    size={item.size}
                    color={item.color}
                    style={layout}
                  />
                );
              })}
            </View>
            <Text style={[styles.greetingHeyLine, styles.greetingText]}>Hey ! {timeGreeting}</Text>
            <Text style={[styles.greetingHelpLine, styles.greetingText]}>
              {userName}, how can I help you?
            </Text>
          </View>

          {/* Chat with Random */}
          <TouchableOpacity
            style={styles.promoBanner}
            activeOpacity={0.88}
            onPress={() => router.push('/random-chat')}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6', '#A855F7', '#EC4899']}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoGradient}
            >
              <View style={styles.promoDecorCircle} />
              <View style={styles.promoBody}>
                <View style={styles.promoContent}>
                  <Text style={styles.promoVed}>Chat with </Text>
                  <Text style={styles.promoInsta}>Random </Text>
                  <View style={styles.freeTag}>
                    <Text style={styles.freeTagText}>Free</Text>
                  </View>
                </View>
                <Text style={styles.promoSubtext}>Connect with learners and practice English</Text>
              </View>
              <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Section 2 — Leaderboard, Performance, Learning English, and below */}
        <ResponsiveContent>
        <View style={styles.progressSection}>
        <View style={styles.quickActionsContainer}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionCard}
              activeOpacity={0.75}
              onPress={() => router.push(action.route)}
            >
              <View style={[styles.actionIconBg, { backgroundColor: action.bg }]}>
                <Image
                  source={action.image}
                  style={styles.actionIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.actionTitle} numberOfLines={2}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.learningSection}>
          <Text style={styles.sectionTitle}>Learning English</Text>
          <View style={styles.learningList}>
            {LEARNING_ACTIONS.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.learningCard}
                onPress={() => {
                  if (item.title === 'Chat in English') {
                    router.push('/random-chat');
                  }
                }}
              >
                <View style={[styles.learningIconBg, { backgroundColor: item.bg }]}>
                  <Image
                    source={item.image}
                    style={styles.learningIconImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.learningInfo}>
                  <Text style={styles.learningCardTitle}>{item.title}</Text>
                  <Text style={styles.learningDesc}>{item.desc}</Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Feather name="chevron-right" size={20} color="#CBD5E0" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Community ad — after Group Discussion */}
          <TouchableOpacity
            style={styles.communityAdBanner}
            activeOpacity={0.92}
            onPress={() => router.push('/random-chat')}
          >
            <LinearGradient
              colors={['#e60000', '#ff3366', '#ff6b9d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.communityAdGradient}
            >
              <View style={styles.communityAdDecorCircle} />
              <View style={styles.communityAdRow}>
                <View style={styles.communityAdTextBlock}>
                  <View style={styles.communityAdTag}>
                    <Text style={styles.communityAdTagText}>Ohm&apos;s English</Text>
                  </View>
                  <Text style={styles.communityAdTitle}>
                    Practice English{'\n'}with real learners
                  </Text>
                  <Text style={styles.communityAdSubtitle}>
                    Chat live, build confidence and make friends
                  </Text>
                  <View style={styles.communityAdCta}>
                    <Text style={styles.communityAdCtaText}>Join free chat</Text>
                    <Feather name="arrow-right" size={16} color="#e60000" />
                  </View>
                  <View style={styles.communityAdAvatars}>
                    {COMMUNITY_AD.faces.map((face, i) => (
                      <Image
                        key={i}
                        source={face}
                        style={[
                          styles.communityAdAvatar,
                          i > 0 && styles.communityAdAvatarOverlap,
                        ]}
                      />
                    ))}
                    <View style={styles.communityAdAvatarBadge}>
                      <Text style={styles.communityAdAvatarBadgeText}>2k+ online</Text>
                    </View>
                  </View>
                </View>
                <Image
                  source={COMMUNITY_AD.hero}
                  style={styles.communityAdHeroImage}
                  resizeMode="cover"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

          <DailyWordHomeTeaser />
        </View>
        </ResponsiveContent>

          <AppFeatureCards />

      </ScrollView>

      <Sidebar
        visible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppUI.bg,
  },
  headerSafeArea: {
    backgroundColor: AppUI.homeHeroGradient[0],
  },
  safeFill: {
    flex: 1,
    backgroundColor: AppUI.bg,
  },
  scroll: {
    flex: 1,
    backgroundColor: AppUI.bg,
  },
  heroSection: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 20,
    backgroundColor: AppUI.homeHeroBottom,
  },
  progressSection: {
    backgroundColor: AppUI.bg,
    paddingTop: 16,
    paddingBottom: 0,
    flexGrow: 1,
  },
  stickyHeaderWrap: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: AppUI.homeHeroGradient[0],
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'android' ? 2 : 5,
    gap: 6,
    backgroundColor: AppUI.homeHeroGradient[0],
  },
  headerMenuBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppUI.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppUI.divider,
    ...cardShadow,
    paddingVertical: 5,
    paddingLeft: 7,
    paddingRight: 8,
    gap: 6,
    minHeight: 36,
  },
  pillAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppUI.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: AppUI.text,
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 0,
  },
  headerIconBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  bannerContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: AppUI.surface,
  },
  bannerImage: {
    width: '100%',
    backgroundColor: AppUI.surfaceMuted,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  activeDot: {
    width: 16,
    backgroundColor: '#6366F1',
  },

  promoBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 1,
    ...cardShadow,
  },
  promoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  promoDecorCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    top: -40,
    right: 24,
  },
  promoBody: {
    flex: 1,
    minWidth: 0,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  promoVed: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  promoInsta: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.92)',
  },
  freeTag: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 4,
  },
  freeTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  promoSubtext: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: AppUI.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...cardShadow,
  },
  actionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  actionIconImage: {
    width: 28,
    height: 28,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: AppUI.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  learningSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  learningList: {
    gap: 12,
    marginTop: 12,
  },
  learningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppUI.surface,
    borderRadius: 20,
    padding: 12,
    ...cardShadow,
  },
  learningIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  learningIconImage: {
    width: 32,
    height: 32,
  },
  learningInfo: {
    flex: 1,
    marginLeft: 16,
  },
  learningCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppUI.text,
    marginBottom: 2,
  },
  learningDesc: {
    fontSize: 12,
    color: AppUI.textSecondary,
    fontWeight: '500',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppUI.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppUI.text,
    marginBottom: 12,
  },
  communityAdBanner: {
    marginTop: 16,
    borderRadius: 22,
    overflow: 'hidden',
    ...cardShadow,
  },
  communityAdGradient: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 168,
    padding: 16,
    paddingRight: 0,
  },
  communityAdDecorCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    top: -50,
    right: 60,
  },
  communityAdRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  communityAdTextBlock: {
    flex: 1,
    paddingRight: 8,
    zIndex: 1,
  },
  communityAdTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  communityAdTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.4,
  },
  communityAdTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 26,
    marginBottom: 6,
  },
  communityAdSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 17,
    marginBottom: 12,
  },
  communityAdCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
    marginBottom: 12,
  },
  communityAdCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e60000',
  },
  communityAdAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityAdAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#eee',
  },
  communityAdAvatarOverlap: {
    marginLeft: -10,
  },
  communityAdAvatarBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  communityAdAvatarBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  communityAdHeroImage: {
    width: 118,
    height: 150,
    borderBottomLeftRadius: 22,
    borderTopLeftRadius: 40,
    marginRight: -2,
  },
  greetingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    marginBottom: 4,
    minHeight: 108,
    overflow: 'hidden',
  },
  greetingTexture: {
    ...StyleSheet.absoluteFillObject,
  },
  greetingText: {
    zIndex: 1,
  },
  greetingHeyLine: {
    fontSize: 22,
    fontWeight: '800',
    color: AppUI.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  greetingHelpLine: {
    fontSize: 15,
    fontWeight: '500',
    color: AppUI.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
