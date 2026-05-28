import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import { performLogout } from '@/utils/session';
import { appVersionLabel } from '@/constants/appInfo';
import { AppUI } from '@/constants/theme';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.82, 320);
const SLIDE_DURATION = 300;
const SLIDE_EASING = Easing.out(Easing.cubic);

/** Samsung drawer — solid black icons */
const ICON_BLACK = AppUI.text;
const ICON_STROKE = 3.25;
const MENU_ICON_SIZE = 23;
const CLOSE_ICON_SIZE = 28;

type MenuItem = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
};

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

function MenuRow({ icon, label, onPress, danger }: MenuItem) {
  const iconColor = danger ? AppUI.accent : ICON_BLACK;
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
      <Feather
        name={icon}
        size={MENU_ICON_SIZE}
        color={iconColor}
        strokeWidth={ICON_STROKE}
      />
      <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
      {!danger && (
        <Feather name="chevron-right" size={20} color={AppUI.textTertiary} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const router = useRouter();
  const [userName, setUserName] = useState('User');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideX.setValue(-DRAWER_WIDTH);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: SLIDE_DURATION,
          easing: SLIDE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: SLIDE_DURATION,
          easing: SLIDE_EASING,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!mounted) return;

    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -DRAWER_WIDTH,
        duration: SLIDE_DURATION - 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: SLIDE_DURATION - 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, mounted, slideX, backdropOpacity]);

  useEffect(() => {
    const loadUser = async () => {
      const name = await AsyncStorage.getItem(AUTH_KEYS.userName);
      setUserName(name?.trim() || 'User');
    };
    if (visible) loadUser();
  }, [visible]);

  const navigateToProfile = () => {
    onClose();
    router.push('/profile');
  };

  const navigateTo = (path: '/about' | '/contact-us' | '/terms' | '/privacy') => {
    onClose();
    router.push(path);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    onClose();
    try {
      await performLogout();
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setUserName('User');
      router.replace('/intro');
      setIsLoggingOut(false);
    }
  };

  const mainItems: MenuItem[] = [
    { icon: 'briefcase', label: 'My Purchases', onPress: onClose },
    { icon: 'info', label: 'About Us', onPress: () => navigateTo('/about') },
    { icon: 'phone', label: 'Contact Us', onPress: () => navigateTo('/contact-us') },
    { icon: 'file-text', label: 'Terms & Conditions', onPress: () => navigateTo('/terms') },
    { icon: 'shield', label: 'Privacy Policy', onPress: () => navigateTo('/privacy') },
  ];

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.sidebarContainer, { transform: [{ translateX: slideX }] }]}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menu</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close menu"
              >
                <Feather
                  name="x"
                  size={CLOSE_ICON_SIZE}
                  color={ICON_BLACK}
                  strokeWidth={ICON_STROKE}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <Ionicons name="person" size={40} color={AppUI.textTertiary} />
              </View>
              <View style={styles.nameHeader}>
                <Text style={styles.username} numberOfLines={1}>
                  {userName}
                </Text>
                <TouchableOpacity onPress={navigateToProfile} hitSlop={8}>
                  <Feather name="edit-2" size={15} color={AppUI.accent} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.viewProfileBtn} onPress={navigateToProfile} activeOpacity={0.7}>
                <Text style={styles.viewProfileText}>View profile</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuList}>
              {mainItems.map((item) => (
                <View key={item.label}>
                  <MenuRow {...item} />
                  <View style={styles.divider} />
                </View>
              ))}

              <View style={styles.sectionGap} />

              <MenuRow
                icon="log-out"
                label={isLoggingOut ? 'Logging out…' : 'Logout'}
                onPress={handleLogout}
                danger
              />
            </View>

            <Text style={styles.versionText}>{appVersionLabel()}</Text>
          </SafeAreaView>
        </Animated.View>

        <Animated.View style={[styles.background, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backgroundTap} />
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  background: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  backgroundTap: {
    flex: 1,
  },
  sidebarContainer: {
    width: DRAWER_WIDTH,
    backgroundColor: AppUI.surface,
    height: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppUI.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppUI.divider,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppUI.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  nameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    color: AppUI.text,
    flexShrink: 1,
  },
  viewProfileBtn: {
    marginTop: 8,
  },
  viewProfileText: {
    fontSize: 14,
    color: AppUI.accent,
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
    paddingTop: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
    minHeight: 52,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: AppUI.text,
    fontWeight: '400',
  },
  menuTextDanger: {
    color: AppUI.accent,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppUI.divider,
    marginLeft: 58,
  },
  sectionGap: {
    height: 8,
    backgroundColor: AppUI.bg,
  },
  versionText: {
    fontSize: 12,
    color: AppUI.textTertiary,
    textAlign: 'center',
    paddingVertical: 16,
    fontWeight: '500',
  },
});
