import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When true, inner column is capped and centered (tablet / wide phones). */
  centered?: boolean;
};

/** Centers page content on tablets while phones stay full width. */
export default function ResponsiveContent({ children, style, centered = true }: Props) {
  const { contentWidth, isTablet } = useResponsiveLayout();

  if (!centered || !isTablet) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={[{ width: '100%', alignItems: 'center' }, style]}>
      <View style={{ width: contentWidth, maxWidth: '100%' }}>{children}</View>
    </View>
  );
}
