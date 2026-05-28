import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO } from '@/constants/appInfo';
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS } from '@/constants/privacyContent';

export default function PrivacyScreen() {
  return (
    <LegalPageLayout title="Privacy Policy" subtitle={`Last updated: ${PRIVACY_LAST_UPDATED}`}>
      <Text style={[legalStyles.body, styles.intro]}>
        {APP_INFO.appName} explains how we handle your data, including sign-in, profile, learning
        progress, and camera or microphone when you use video practice.
      </Text>

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
    marginBottom: 20,
  },
  lastSection: {
    marginBottom: 0,
  },
});
