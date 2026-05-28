import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  getDailyWordDayNumber,
  getDailyWordForToday,
} from '@/constants/dailyWords';
import {
  claimDailyWordPoints,
  DAILY_WORD_POINTS,
  JOURNEY_COMPLETION_BONUS,
  hasClaimedDailyWordToday,
  isAdvancedDailyWord,
} from '@/utils/dailyWordRewards';
import { DAILY_WORD_TOTAL_DAYS } from '@/constants/dailyWords';

const UI = {
  text: '#101010',
  textMuted: '#6B7280',
  textSoft: '#9CA3AF',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F3F7',
  accent: '#e60000',
  accentSoft: 'rgba(230, 0, 0, 0.08)',
  link: '#1B6EF3',
  success: '#12B76A',
  successSoft: '#ECFDF3',
  shadow: '#000000',
};

type Props = {
  onClaimSuccess?: () => void;
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

export default function DailyWordCard({ onClaimSuccess }: Props) {
  const word = getDailyWordForToday();
  const dayNumber = getDailyWordDayNumber();
  const isAdvanced = isAdvancedDailyWord(dayNumber);

  const [speaking, setSpeaking] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [activeTab, setActiveTab] = useState<'definitions' | 'examples'>('definitions');

  const refreshStatus = useCallback(async () => {
    setClaimed(await hasClaimedDailyWordToday());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshStatus();
    }, [refreshStatus])
  );

  const speakWord = useCallback(() => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(word.word, {
      language: 'en-US',
      rate: 0.85,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [word.word]);

  const handleClaimPoints = useCallback(async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      const result = await claimDailyWordPoints();
      if (result.claimed) {
        setClaimed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClaimSuccess?.();
        if (result.journeyBonusAdded > 0) {
          Alert.alert(
            '100 days complete!',
            `You finished the vocabulary journey and earned ${JOURNEY_COMPLETION_BONUS} bonus points!`
          );
        }
      }
    } finally {
      setClaiming(false);
    }
  }, [claiming, claimed, onClaimSuccess]);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>Day {dayNumber}</Text>
        </View>
        {isAdvanced ? (
          <View style={styles.advancedPill}>
            <Feather name="zap" size={12} color="#B45309" />
            <Text style={styles.advancedText}>Advanced</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardTitle}>Word of the day</Text>

      <View style={styles.wordBlock}>
        <View style={styles.wordTextCol}>
          <Text style={styles.word}>{word.word}</Text>
          <Text style={styles.phonetic}>{word.phonetic}</Text>
          <View style={styles.posChip}>
            <Text style={styles.posText}>{word.partOfSpeech}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.speakBtn, speaking && styles.speakBtnActive]}
          onPress={speakWord}
          accessibilityLabel="Listen to pronunciation"
          activeOpacity={0.8}
        >
          {speaking ? (
            <ActivityIndicator size="small" color={UI.accent} />
          ) : (
            <Feather name="volume-2" size={22} color={UI.accent} />
          )}
        </TouchableOpacity>
      </View>

      {/* Samsung-style segmented control */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'definitions' && styles.segmentActive]}
          onPress={() => setActiveTab('definitions')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, activeTab === 'definitions' && styles.segmentTextActive]}>
            Meaning
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'examples' && styles.segmentActive]}
          onPress={() => setActiveTab('examples')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, activeTab === 'examples' && styles.segmentTextActive]}>
            Example
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'definitions' ? (
        <View style={styles.panel}>
          <Text style={styles.defText}>{word.meaning}</Text>
          {word.tenses ? (
            <View style={styles.infoBlock}>
              <Text style={styles.subHeading}>Forms & tenses</Text>
              <Text style={styles.bodyText}>{word.tenses}</Text>
            </View>
          ) : null}
          <View style={styles.infoBlock}>
            <Text style={styles.subHeading}>Where to use</Text>
            <Text style={styles.bodyText}>{word.whereUsed}</Text>
          </View>
          <Text style={styles.subHeading}>Similar words</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {word.synonyms.map((syn) => (
                <TouchableOpacity
                  key={syn}
                  style={styles.chip}
                  onPress={() => Speech.speak(syn, { language: 'en' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipText}>{syn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.panel}>
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>&ldquo;{word.example}&rdquo;</Text>
          </View>
          <TouchableOpacity
            style={styles.listenRow}
            onPress={() => Speech.speak(word.example, { language: 'en-US', rate: 0.9 })}
            activeOpacity={0.8}
          >
            <Feather name="volume-1" size={18} color={UI.link} />
            <Text style={styles.listenText}>Listen to example</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.claimBlock}>
        {claimed ? (
          <View style={styles.claimedBanner}>
            <Feather name="check-circle" size={22} color={UI.success} />
            <Text style={styles.claimedText}>
              +{DAILY_WORD_POINTS} points added — see you tomorrow
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleClaimPoints}
            disabled={claiming}
            activeOpacity={0.9}
            style={styles.claimTouchable}
          >
            <LinearGradient
              colors={[UI.accent, '#ff4d4d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.claimBtn}
            >
              {claiming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="gift" size={20} color="#fff" />
                  <Text style={styles.claimBtnText}>Claim +{DAILY_WORD_POINTS} points</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
        <Text style={styles.claimHint}>
          Daily claim · {DAILY_WORD_TOTAL_DAYS}-day journey bonus {JOURNEY_COMPLETION_BONUS.toLocaleString()} pts
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...cardShadow,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayPill: {
    backgroundColor: UI.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.textMuted,
  },
  advancedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  advancedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  wordBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: UI.surfaceMuted,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  wordTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  word: {
    fontSize: 36,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.8,
  },
  phonetic: {
    fontSize: 15,
    color: UI.textMuted,
    marginTop: 4,
  },
  posChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: UI.surface,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  posText: {
    fontSize: 13,
    color: UI.textMuted,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  speakBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: UI.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  speakBtnActive: {
    backgroundColor: UI.accentSoft,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: UI.surfaceMuted,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: UI.surface,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.textSoft,
  },
  segmentTextActive: {
    color: UI.text,
  },
  panel: {
    marginBottom: 4,
  },
  defText: {
    fontSize: 16,
    lineHeight: 25,
    color: UI.text,
  },
  infoBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.textMuted,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: UI.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  chip: {
    backgroundColor: UI.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI.text,
  },
  quoteCard: {
    backgroundColor: UI.surfaceMuted,
    borderRadius: 18,
    padding: 18,
  },
  quoteText: {
    fontSize: 17,
    lineHeight: 26,
    color: UI.text,
    fontStyle: 'italic',
  },
  listenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
  },
  listenText: {
    fontSize: 15,
    color: UI.link,
    fontWeight: '600',
  },
  claimBlock: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  claimTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  claimBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  claimedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: UI.successSoft,
    paddingVertical: 16,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  claimedText: {
    fontSize: 15,
    fontWeight: '600',
    color: UI.success,
    flexShrink: 1,
  },
  claimHint: {
    fontSize: 12,
    color: UI.textSoft,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 17,
  },
});
