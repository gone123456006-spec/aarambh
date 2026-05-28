import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUI, cardShadow } from '@/constants/theme';

const NAV_ICON = { color: AppUI.text, strokeWidth: 3 };

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function LegalPageLayout({ title, subtitle, children }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={AppUI.bg} />
      <View style={[styles.navBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          activeOpacity={0.65}
        >
          <Feather name="arrow-left" size={24} {...NAV_ICON} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
      >
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={[styles.card, cardShadow]}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** Shared text styles for legal / info screens */
export const legalStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: AppUI.textSecondary,
  },
  bodyDark: {
    fontSize: 15,
    lineHeight: 24,
    color: AppUI.text,
  },
  meta: {
    fontSize: 13,
    color: AppUI.textTertiary,
    fontWeight: '500',
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppUI.text,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppUI.divider,
    marginLeft: 54,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppUI.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: AppUI.bg,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: AppUI.text,
    letterSpacing: -0.3,
    marginRight: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: AppUI.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
    fontWeight: '400',
  },
  card: {
    backgroundColor: AppUI.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
  },
});
