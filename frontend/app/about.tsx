import React from 'react';
import { Text, StyleSheet } from 'react-native';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO, appVersionLabel } from '@/constants/appInfo';
import { ABOUT_PARAGRAPHS } from '@/constants/aboutContent';
import { AppUI } from '@/constants/theme';

export default function AboutScreen() {
  return (
    <LegalPageLayout title="About Us" subtitle={APP_INFO.tagline}>
      <Text style={styles.versionLine}>{appVersionLabel()}</Text>
      {ABOUT_PARAGRAPHS.map((paragraph, index) => (
        <Text
          key={index}
          style={[legalStyles.body, index < ABOUT_PARAGRAPHS.length - 1 && styles.paragraphGap]}
        >
          {paragraph}
        </Text>
      ))}
    </LegalPageLayout>
  );
}

const styles = StyleSheet.create({
  versionLine: {
    fontSize: 13,
    fontWeight: '600',
    color: AppUI.accent,
    marginBottom: 16,
  },
  paragraphGap: {
    marginBottom: 16,
  },
});
