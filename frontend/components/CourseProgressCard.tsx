import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TOTAL_LESSONS } from '@/constants/courseData';

const UI = {
  text: '#101010',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  surface: '#FFFFFF',
  accent: '#e60000',
  blue: '#1B6EF3',
  blueSoft: '#E8F1FE',
  shadow: '#000000',
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
});

export function CourseProgressCard({
  overallProgress,
  completedCount,
  lastLessonTitle,
  onContinue,
}: {
  overallProgress: number;
  completedCount: number;
  lastLessonTitle: string | null;
  onContinue: () => void;
}) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FBFF', '#EEF4FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.eyebrow}>Course progress</Text>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroValue}>{overallProgress}%</Text>
            <Text style={styles.heroCaption}>Overall completion</Text>
          </View>
          <View style={styles.heroIcon}>
            <Feather name="book-open" size={26} color={UI.blue} />
          </View>
        </View>

        <View style={styles.track}>
          <LinearGradient
            colors={[UI.blue, '#5B9FFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.fill,
              { width: `${Math.max(overallProgress, overallProgress > 0 ? 4 : 0)}%` },
            ]}
          />
        </View>

        <Text style={styles.meta}>
          {completedCount} of {TOTAL_LESSONS} lessons completed
        </Text>
        {lastLessonTitle ? (
          <Text style={styles.last} numberOfLines={1}>
            Last lesson: {lastLessonTitle}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
          onPress={onContinue}
        >
          <Feather name="play-circle" size={20} color={UI.blue} />
          <Text style={styles.continueBtnText}>Continue learning</Text>
          <Feather name="chevron-right" size={20} color={UI.textTertiary} style={styles.continueChevron} />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    ...cardShadow,
  },
  gradient: {
    padding: 22,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.textSecondary,
    marginBottom: 8,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroValue: {
    fontSize: 44,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -1.5,
  },
  heroCaption: {
    fontSize: 14,
    color: UI.textSecondary,
    marginTop: 4,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: UI.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 8,
    backgroundColor: '#ECEEF2',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 8,
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.text,
    marginBottom: 4,
  },
  last: {
    fontSize: 13,
    color: UI.textSecondary,
    marginBottom: 16,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: UI.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  continueBtnPressed: {
    opacity: 0.9,
  },
  continueBtnText: {
    flex: 1,
    color: UI.blue,
    fontWeight: '700',
    fontSize: 16,
  },
  continueChevron: {
    marginLeft: 'auto',
  },
});
