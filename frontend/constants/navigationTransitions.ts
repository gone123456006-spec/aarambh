import { Platform, Easing } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { getTabBarBottomInset } from '@/utils/safeAreaInsets';
import type { EdgeInsets } from 'react-native-safe-area-context';

/** Stack push/pop — tuned for smooth native motion without feeling sluggish. */
export const STACK_DURATION = 320;
export const STACK_FADE_DURATION = 280;
export const TAB_SWITCH_DURATION = 180;

const stackAnimation = Platform.select({
  ios: 'default' as const,
  android: 'slide_from_right' as const,
  default: 'slide_from_right' as const,
});

const stackBase: NativeStackNavigationOptions = {
  headerShown: false,
  animation: stackAnimation,
  animationDuration: STACK_DURATION,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  fullScreenGestureEnabled: Platform.OS === 'ios',
  freezeOnBlur: false,
  contentStyle: { backgroundColor: '#FFFFFF' },
};

export const stackScreenOptions: NativeStackNavigationOptions = {
  ...stackBase,
};

/** Soft fade for splash → intro and login → home (no horizontal slide). */
export const stackFadeScreen: NativeStackNavigationOptions = {
  ...stackBase,
  animation: 'fade',
  animationDuration: STACK_FADE_DURATION,
  gestureEnabled: false,
};

/** Standard push/pop for detail screens (profile, chat, legal, etc.). */
export const stackSlideScreen: NativeStackNavigationOptions = {
  ...stackBase,
};

/** Modal sheets — slide up / down. */
export const stackModalScreen: NativeStackNavigationOptions = {
  ...stackBase,
  presentation: 'modal',
  animation: 'slide_from_bottom',
  animationDuration: STACK_DURATION,
  gestureEnabled: true,
  fullScreenGestureEnabled: false,
};

export const tabScreenOptions: BottomTabNavigationOptions = {
  // Instant tab switches on Android; short native fade on iOS.
  animation: Platform.OS === 'android' ? 'none' : 'fade',
  ...(Platform.OS === 'ios'
    ? {
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: TAB_SWITCH_DURATION,
            easing: Easing.out(Easing.cubic),
          },
        },
      }
    : {}),
  lazy: true,
  freezeOnBlur: false,
};

const TAB_BAR_CONTENT_HEIGHT = 56;
const TAB_BAR_BG = '#FFFFFF';

export { TAB_BAR_CONTENT_HEIGHT };

/** Shared tab bar style — keep in sync with app/(tabs)/_layout.tsx */
export function getDefaultTabBarStyle(insets: EdgeInsets) {
  const bottomInset = getTabBarBottomInset(insets);

  return {
    display: 'flex' as const,
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
    backgroundColor: TAB_BAR_BG,
    height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
    paddingBottom: bottomInset,
    paddingTop: 8,
    opacity: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  };
}

/** Hide bottom tabs while a full-screen game is open (works on iOS + Android). */
export function getHiddenTabBarStyle() {
  return Platform.select({
    ios: { display: 'none' as const },
    android: {
      display: 'none' as const,
      height: 0,
      minHeight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      borderTopWidth: 0,
      elevation: 0,
    },
    default: { display: 'none' as const },
  });
}

/** Run after stack/tab transition so navigation stays smooth. */
export const NAV_TRANSITION_DEFER_MS = STACK_DURATION + 40;
