import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO } from '@/constants/appInfo';
import { PLAY_STORE_URLS } from '@/constants/playStore';
import { AppUI } from '@/constants/theme';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '@/constants/termsContent';

export default function TermsScreen() {
  const openWebTerms = () => {
    void Linking.openURL(PLAY_STORE_URLS.termsAndConditions);
  };

  return (
    <LegalPageLayout title="Terms & Conditions" subtitle={`Last updated: ${TERMS_LAST_UPDATED}`}>
      <Text style={[legalStyles.body, styles.intro]}>
        Please read these Terms before using {APP_INFO.appName}. They cover user safety, random chat
        rules, reporting, account deletion, and Google Play distribution requirements.
      </Text>

      <TouchableOpacity style={styles.webLink} onPress={openWebTerms} activeOpacity={0.7}>
        <Text style={styles.webLinkText}>View web version (Google Play)</Text>
      </TouchableOpacity>

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
    marginBottom: 12,
  },
  webLink: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 4,
  },
  webLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppUI.accent,
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
