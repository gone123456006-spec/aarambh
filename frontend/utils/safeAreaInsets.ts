import { Platform, type ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/** Fallback when Android 3-button nav reports insets.bottom = 0. */
export const ANDROID_NAV_BAR_FALLBACK = 48;

/** Pull sticky headers slightly closer to the status bar on Android (edge-to-edge). */
export const ANDROID_HEADER_LIFT = 6;

/** Bottom inset for tab bar + footers — works on iOS, Android (3-button & gesture), tablets. */
export function getTabBarBottomInset(insets: EdgeInsets): number {
  if (Platform.OS === 'ios') {
    return insets.bottom;
  }

  // Gesture nav / edge-to-edge usually reports a real inset.
  if (insets.bottom >= 16) {
    return insets.bottom;
  }

  return ANDROID_NAV_BAR_FALLBACK;
}

/** General bottom padding for input bars and footers. */
export function getBottomInset(insets: EdgeInsets): number {
  return getTabBarBottomInset(insets);
}

/** Tighter top spacing for home-style headers on Android only. */
export function getAndroidHeaderCompactStyle(): ViewStyle | undefined {
  if (Platform.OS !== 'android') return undefined;
  return {
    marginTop: -ANDROID_HEADER_LIFT,
    paddingTop: 2,
    paddingBottom: 4,
  };
}

/** Top padding for custom nav bars that set paddingTop manually (e.g. random chat). */
export function getNavBarTopPadding(insets: EdgeInsets): number {
  if (Platform.OS !== 'android') {
    return insets.top;
  }
  return Math.max(insets.top - ANDROID_HEADER_LIFT, 0);
}
