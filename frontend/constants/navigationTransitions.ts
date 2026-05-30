import { Platform } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/** Default stack push/pop — native feel on iOS, slide on Android. */
export const STACK_DURATION = 280;
export const STACK_FADE_DURATION = 300;
export const TAB_FADE_DURATION = 220;

export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
  animationDuration: STACK_DURATION,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  fullScreenGestureEnabled: Platform.OS === 'ios',
  freezeOnBlur: true,
  contentStyle: { backgroundColor: '#FFFFFF' },
};

export const stackFadeScreen: NativeStackNavigationOptions = {
  animation: 'fade',
  animationDuration: STACK_FADE_DURATION,
  gestureEnabled: false,
};

export const stackSlideScreen: NativeStackNavigationOptions = {
  animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
  animationDuration: STACK_DURATION,
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === 'ios',
};

export const tabScreenOptions: BottomTabNavigationOptions = {
  animation: 'fade',
  transitionSpec: {
    animation: 'timing',
    config: { duration: TAB_FADE_DURATION },
  },
  lazy: true,
  freezeOnBlur: true,
};

const TAB_BAR_CONTENT_HEIGHT = 56;

/** Shared tab bar style — keep in sync with app/(tabs)/_layout.tsx */
export function getDefaultTabBarStyle(bottomInset: number) {
  const inset = Platform.OS === 'android' ? Math.max(bottomInset, 0) : bottomInset;
  return {
    display: 'flex' as const,
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
    backgroundColor: '#FFFFFF',
    height: TAB_BAR_CONTENT_HEIGHT + inset,
    paddingBottom: inset,
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
