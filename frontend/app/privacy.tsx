import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO } from '@/constants/appInfo';
import { PLAY_STORE_URLS } from '@/constants/playStore';
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS } from '@/constants/privacyContent';
import { AppUI } from '@/constants/theme';

export default function PrivacyScreen() {
  const openWebPolicy = () => {
    void Linking.openURL(PLAY_STORE_URLS.privacyPolicy);
  };

  return (
    <LegalPageLayout title="Privacy Policy" subtitle={`Last updated: ${PRIVACY_LAST_UPDATED}`}>
      <Text style={[legalStyles.body, styles.intro]}>
        {APP_INFO.appName} explains how we handle your data, including sign-in, profile, learning
        progress, and camera or microphone when you use video practice.
      </Text>

      <TouchableOpacity style={styles.webLink} onPress={openWebPolicy} activeOpacity={0.7}>
        <Text style={styles.webLinkText}>View web version (Google Play)</Text>
      </TouchableOpacity>

      {PRIVACY_SECTIONS.map((section, index) => (
        <View
          key={index}
          style={[legalStyles.section, index === PRIVACY_SECTIONS.length - 1 && styles.lastSection]}
        >
          <Text style={legalStyles.sectionTitle}>{section.title}</Text>
          <Text style={legalStyles.body}>{section.body}</Text>
        </View>
      ))}
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
    marginBottom: 0,
  },
});
