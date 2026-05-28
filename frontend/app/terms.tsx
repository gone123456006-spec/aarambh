import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO } from '@/constants/appInfo';
import { AppUI } from '@/constants/theme';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '@/constants/termsContent';

export default function TermsScreen() {
  return (
    <LegalPageLayout title="Terms & Conditions" subtitle={`Last updated: ${TERMS_LAST_UPDATED}`}>
      <Text style={[legalStyles.body, styles.intro]}>
        Please read these Terms carefully before using {APP_INFO.appName}. They cover user safety,
        acceptable use, privacy, and limitation of liability for Google Play distribution.
      </Text>

      {TERMS_SECTIONS.map((section, index) => (
        <View
          key={index}
          style={[legalStyles.section, index === TERMS_SECTIONS.length - 1 && styles.lastSection]}
        >
          <Text style={legalStyles.sectionTitle}>{section.title}</Text>
          <Text style={legalStyles.body}>{section.body}</Text>
        </View>
      ))}

      <Text style={styles.footer}>
        By using {APP_INFO.appName} from Google Play, you also agree to Google Play&apos;s Terms of
        Service and applicable policies.
      </Text>
    </LegalPageLayout>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: 20,
  },
  lastSection: {
    marginBottom: 12,
  },
  footer: {
    fontSize: 13,
    lineHeight: 20,
    color: AppUI.textSecondary,
    fontWeight: '400',
  },
});
