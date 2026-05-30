import { useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 600;
const LARGE_TABLET_MIN_WIDTH = 840;
export const MAX_CONTENT_WIDTH = 768;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const isLargeTablet = width >= LARGE_TABLET_MIN_WIDTH;
  const contentWidth = isTablet ? Math.min(width, MAX_CONTENT_WIDTH) : width;
  const pagePaddingX = isTablet ? Math.max(20, Math.round((width - contentWidth) / 2)) : 16;

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    contentWidth,
    pagePaddingX,
  };
}
