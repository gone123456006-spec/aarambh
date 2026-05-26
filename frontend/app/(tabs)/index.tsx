import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import Sidebar from '@/components/Sidebar';

const { width } = Dimensions.get('window');

/** Icons8 3D Fluency — https://icons8.com/icons/fluency */
const ICONS = {
  trophy: 'https://img.icons8.com/3d-fluency/48/trophy.png',
  performance: 'https://img.icons8.com/3d-fluency/48/combo-chart.png',
  sun: 'https://img.icons8.com/3d-fluency/94/summer.png',
  moon: 'https://img.icons8.com/3d-fluency/94/crescent-moon.png',
};

const BANNERS = [
  {
    id: 1,
    title1: "Olympiad",
    title2: "Math Mastery",
    grade: "Grade 3",
    footerText: "SOF- IMO | Math Kangaroo",
    colors: ['#e60000', '#ff1a1a', '#ff4d4d']
  },
  {
    id: 2,
    title1: "Science",
    title2: "Explorers",
    grade: "Grade 4",
    footerText: "NSO | Science Olympiad",
    colors: ['#0984e3', '#74b9ff', '#81ecec']
  },
  {
    id: 3,
    title1: "English",
    title2: "Grammar Pro",
    grade: "Grade 5",
    footerText: "IEO | English Olympiad",
    colors: ['#00b894', '#55efc4', '#a8e6cf']
  },
  {
    id: 4,
    title1: "Coding",
    title2: "Logic Builders",
    grade: "Grade 3+",
    footerText: "NCO | Cyber Olympiad",
    colors: ['#6c5ce7', '#a29bfe', '#dfe6e9']
  }
];

const QUICK_ACTIONS = [
  { id: 1, title: 'Leaderboard', imageUrl: ICONS.trophy, bg: '#FFF5F5', route: '/leaderboard' as const },
  { id: 2, title: 'Performance', imageUrl: ICONS.performance, bg: '#FFF9F0', route: '/performance' as const },
];

/** Icons8 3D Fluency — https://icons8.com/icons/fluency */
const LEARNING_ACTIONS = [
  {
    id: 1,
    title: 'Chat in English',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/speech-bubble.png',
    bg: '#F3F0FF',
    desc: 'Chat with real learners live',
  },
  {
    id: 2,
    title: 'Call in English',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/phone.png',
    bg: '#EBFBEE',
    desc: 'Build confidence with voice calls',
  },
  {
    id: 3,
    title: 'Group Discussion',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/conference-call.png',
    bg: '#E1F5FE',
    desc: 'Practice speaking in small groups',
  },
];

export default function HomeScreen() {
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [userName, setUserName] = useState('User');
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = activeBannerIndex + 1;
      if (nextIndex >= BANNERS.length) {
        nextIndex = 0;
      }
      scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setActiveBannerIndex(nextIndex);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeBannerIndex]);

  const loadUserName = useCallback(async () => {
    try {
      const storedName = await AsyncStorage.getItem(AUTH_KEYS.userName);
      if (storedName?.trim()) {
        setUserName(storedName.trim().split(' ')[0]);
      } else {
        setUserName('User');
      }
    } catch (e) {
      console.error('Failed to load user name', e);
    }
  }, []);

  useEffect(() => {
    loadUserName();
  }, [loadUserName]);

  useFocusEffect(
    useCallback(() => {
      loadUserName();
    }, [loadUserName])
  );

  const [greetingIconFailed, setGreetingIconFailed] = useState(false);

  const getGreetingData = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return {
        text: 'Good Morning',
        imageUrl: ICONS.sun,
        bg: '#FEF7E0',
        featherIcon: 'sun' as const,
        featherColor: '#E8710A',
      };
    }
    if (hour < 17) {
      return {
        text: 'Good Afternoon',
        imageUrl: ICONS.sun,
        bg: '#FFF9F0',
        featherIcon: 'sun' as const,
        featherColor: '#E8710A',
      };
    }
    return {
      text: 'Good Evening',
      imageUrl: ICONS.moon,
      bg: '#E8EAF6',
      featherIcon: 'moon' as const,
      featherColor: '#5C6BC0',
    };
  };

  const greeting = getGreetingData();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View>
          <LinearGradient
            colors={['#FFFFFF', '#E9EDC9']}
            style={StyleSheet.absoluteFill}
          />
          {/* Header navigation as a card */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={require('../../assets/images/aarambh-icon.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setSidebarVisible(true)}>
                <Feather name="menu" size={28} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting Section */}
          <View style={styles.greetingContainer}>
            <View style={styles.greetingContent}>
              <View>
                <Text style={styles.greetingText}>{greeting.text},</Text>
                <Text style={styles.userNameText}>{userName} <Text style={styles.handEmoji}>👋</Text></Text>
              </View>
              <View style={[styles.greetingIconContainer, { backgroundColor: greeting.bg }]}>
                {!greetingIconFailed ? (
                  <Image
                    source={{ uri: greeting.imageUrl }}
                    style={styles.greetingIconImage}
                    resizeMode="contain"
                    onError={() => setGreetingIconFailed(true)}
                  />
                ) : (
                  <Feather
                    name={greeting.featherIcon}
                    size={18}
                    color={greeting.featherColor}
                  />
                )}
              </View>
            </View>
          </View>

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
                const index = Math.round(x / width);
                setActiveBannerIndex(index);
              }}
            >
              {BANNERS.map((banner) => (
                <View key={banner.id} style={{ width: width, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={styles.bannerContainer}>
                    <LinearGradient
                      colors={banner.colors as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.bannerGradient}
                    >
                      <View style={styles.bannerContent}>
                        <View style={styles.gradeTag}>
                          <Text style={styles.gradeTagText}>{banner.grade}</Text>
                        </View>
                        <Text style={styles.bannerTitle}>{banner.title1}</Text>
                        <Text style={styles.bannerTitle}>{banner.title2}</Text>
                      </View>
                    </LinearGradient>
                    <View style={styles.bannerFooter}>
                      <Text style={styles.bannerFooterText}>{banner.footerText}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Pagination Dots */}
            <View style={styles.pagination}>
              {BANNERS.map((_, index) => (
                <View key={index} style={[styles.dot, activeBannerIndex === index && styles.activeDot]} />
              ))}
            </View>
          </View>

          {/* Promo Banner */}
          <TouchableOpacity
            style={[styles.promoBanner, { marginBottom: 20 }]}
            activeOpacity={0.75}
            onPress={() => router.push('/random-chat')}
          >
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
            <Feather name="chevron-right" size={22} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        {/* Quick Actions Section */}
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
                  source={{ uri: action.imageUrl }}
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

        {/* Learning English Section */}
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
                    source={{ uri: item.imageUrl }}
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
        </View>

      </ScrollView>

      <Sidebar
        visible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -10,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  headerRight: {
    flexDirection: 'row',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  bannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bannerGradient: {
    height: 140,
    padding: 20,
    justifyContent: 'center',

  },
  bannerContent: {
    justifyContent: 'center',
    height: '100%',
  },
  gradeTag: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  gradeTagText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  bannerFooter: {
    backgroundColor: '#000000',
    padding: 8,
    alignItems: 'center',
  },
  bannerFooterText: {
    fontWeight: '700',
    fontSize: 12,
    color: '#ffffff',
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
    backgroundColor: '#e0e0e0',
  },
  activeDot: {
    width: 16,
    backgroundColor: '#fff',
  },

  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8eaf6',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#e60000',
  },
  promoInsta: {
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: 'bold',
    color: '#000',
  },
  freeTag: {
    backgroundColor: '#e60000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  freeTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  promoSubtext: {
    color: '#666',
    fontSize: 12,
    lineHeight: 17,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    color: '#2d3436',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Learning Section
  learningSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  learningList: {
    gap: 12,
    marginTop: 12,
  },
  learningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
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
    color: '#1A202C',
    marginBottom: 2,
  },
  learningDesc: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  greetingContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 12,
  },
  greetingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  greetingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginTop: 1,
  },
  handEmoji: {
    fontSize: 14,
  },
  greetingIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  greetingIconImage: {
    width: 26,
    height: 26,
  },
});
