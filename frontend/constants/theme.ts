/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#e60000',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/** Shared surfaces — Rewards, Games, Home, My Courses */
export const AppUI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEEF2',
  text: '#101010',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#e60000',
  accentGlow: 'rgba(230, 0, 0, 0.12)',
  /** Home hero — soft English-learning gradient (navbar → Chat with Random) */
  homeHeroTop: '#EDE9FE',
  homeHeroMid: '#EDE9FE',
  homeHeroLower: '#DBEAFE',
  homeHeroFade: '#F0F9FF',
  homeHeroBottom: '#FFFFFF',
  homeHeroGradient: ['#EDE9FE', '#DBEAFE', '#E0F2FE', '#F0F9FF', '#FFFFFF'] as const,
  homeHeroGradientLocations: [0, 0.28, 0.52, 0.8, 1] as const,
  divider: 'rgba(0,0,0,0.06)',
  shadow: '#000000',
};

export const cardShadow = Platform.select({
  ios: {
    shadowColor: AppUI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
});

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
