import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TOTAL_LESSONS } from '@/constants/courseData';

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );
}

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
      <SectionHeading title="Course progress" />
      <View style={styles.hero}>
        <Text style={styles.heroValue}>{overallProgress}%</Text>
        <Text style={styles.heroCaption}>Overall completion</Text>
      </View>
      <View style={styles.track}>
        <View
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
          Last: {lastLessonTitle}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.7}>
        <MaterialCommunityIcons name="play-circle-outline" size={20} color="#1A73E8" />
        <Text style={styles.continueBtnText}>Continue learning</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EAED',
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: { paddingTop: 2, paddingBottom: 0, marginBottom: 8 },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6368',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionHeaderLine: { height: 1, backgroundColor: '#E8EAED', marginBottom: 6 },
  hero: { alignItems: 'center', marginBottom: 8 },
  heroValue: {
    fontSize: 36,
    fontWeight: '400',
    color: '#1F1F1F',
    letterSpacing: -0.5,
  },
  heroCaption: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5F6368',
    marginTop: 2,
  },
  track: {
    height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: {
    height: '100%',
    backgroundColor: '#1A73E8',
    borderRadius: 2,
  },
  meta: {
    fontSize: 12,
    color: '#5F6368',
    textAlign: 'center',
    marginBottom: 4,
  },
  last: {
    fontSize: 12,
    color: '#80868B',
    textAlign: 'center',
    marginBottom: 12,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
    marginTop: 4,
  },
  continueBtnText: {
    color: '#1A73E8',
    fontWeight: '600',
    fontSize: 14,
  },
});
