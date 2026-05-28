import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Platform, StatusBar, Dimensions,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useGameTabBar } from '@/contexts/game-tab-bar-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  QUIZ_QUESTIONS,
  WORD_SCRAMBLES,
  FILL_BLANKS,
  FLASHCARDS,
  QUIZ_LEVEL_COUNT,
  SCRAMBLE_LEVEL_COUNT,
  FILL_BLANK_LEVEL_COUNT,
  FLASHCARD_LEVEL_COUNT,
  POINTS_PER_CORRECT_LEVEL,
  getQuizExplanation,
  shortExplanation,
} from '@/constants/gameData';
import { getTotalGameScore, setTotalGameScore } from '@/utils/gameStats';
import { useFocusEffect } from 'expo-router';
import { useGameProgress } from '@/hooks/use-game-progress';
import { GameId, loadAllGameProgress, GameProgress } from '@/utils/gameProgress';
import { recordGameAnswer } from '@/utils/gameStats';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_H_PADDING = 20;
const GAME_GRID_GAP = 14;
const GAME_CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - CONTENT_H_PADDING * 2 - GAME_GRID_GAP) / 2
);

/** Icons8 3D Fluency — https://icons8.com */
const GAMES = [
  {
    id: 'quiz' as GameId,
    title: 'Word Quiz',
    desc: `${QUIZ_LEVEL_COUNT} levels · Vocabulary & grammar`,
    color: '#e60000',
    heroBg: '#FFEBEE',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/help.png',
    total: QUIZ_LEVEL_COUNT,
  },
  {
    id: 'scramble' as GameId,
    title: 'Word Scramble',
    desc: `${SCRAMBLE_LEVEL_COUNT} levels · Unscramble letters`,
    color: '#6C5CE7',
    heroBg: '#F0EEFF',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/puzzle.png',
    total: SCRAMBLE_LEVEL_COUNT,
  },
  {
    id: 'fill' as GameId,
    title: 'Fill in the Blanks',
    desc: `${FILL_BLANK_LEVEL_COUNT} levels · Complete sentences`,
    color: '#00b894',
    heroBg: '#E8F8F5',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/pencil.png',
    total: FILL_BLANK_LEVEL_COUNT,
  },
  {
    id: 'flash' as GameId,
    title: 'Flashcards',
    desc: `${FLASHCARD_LEVEL_COUNT} levels · Learn vocabulary`,
    color: '#0984e3',
    heroBg: '#E3F2FD',
    imageUrl: 'https://img.icons8.com/3d-fluency/94/cards.png',
    total: FLASHCARD_LEVEL_COUNT,
  },
];

const SCORE_TROPHY_LOGO = 'https://img.icons8.com/3d-fluency/48/trophy.png';

const UI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FA',
  text: '#101010',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#e60000',
  accentGlow: 'rgba(230, 0, 0, 0.12)',
  divider: 'rgba(0,0,0,0.06)',
  shadow: '#000000',
};

/** Aptitude-style MCQ (purple, white, radio options) */
const MCQ = {
  purple: '#7B61FF',
  purpleDark: '#6B4FE8',
  purpleLight: '#F3EEFF',
  purpleTrack: '#E8E4F5',
  border: '#E5E7EB',
  bg: '#FFFFFF',
  correctBg: '#E8F8F0',
  correctBorder: '#34C759',
  wrongBg: '#FFF0F0',
  wrongBorder: '#FF6B6B',
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

export type GameHeaderMeta = {
  level: number;
  total: number;
  accentColor: string;
  /** e.g. "Lv" or "Card" */
  levelPrefix?: string;
};

function useSyncGameHeader(
  onHeaderMeta: ((meta: GameHeaderMeta | null) => void) | undefined,
  meta: GameHeaderMeta | null,
) {
  useEffect(() => {
    onHeaderMeta?.(meta);
    return () => onHeaderMeta?.(null);
  }, [onHeaderMeta, meta?.level, meta?.total, meta?.accentColor, meta?.levelPrefix]);
}

function GamesHeader({
  title,
  subtitle,
  onBack,
  gameMeta,
  aptitudeStyle,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  gameMeta?: GameHeaderMeta | null;
  aptitudeStyle?: boolean;
}) {
  if (onBack) {
    if (aptitudeStyle) {
      return (
        <View style={ui.aptitudeHeader}>
          <TouchableOpacity onPress={onBack} style={ui.aptitudeBackBtn} activeOpacity={0.7} hitSlop={12}>
            <Feather name="chevron-left" size={22} color={UI.text} />
          </TouchableOpacity>
          <Text style={ui.aptitudeHeaderTitle} numberOfLines={1}>
            {title}
          </Text>
          {gameMeta ? (
            <View style={ui.aptitudeHeaderRight}>
              <Feather name="clock" size={16} color={UI.text} />
              <Text style={ui.aptitudeHeaderTimer}>
                {gameMeta.level}/{gameMeta.total}
              </Text>
            </View>
          ) : (
            <View style={ui.aptitudeHeaderRightPlaceholder} />
          )}
        </View>
      );
    }

    return (
      <View style={ui.navBar}>
        <TouchableOpacity onPress={onBack} style={ui.backBtn} activeOpacity={0.65} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={UI.text} strokeWidth={3} />
        </TouchableOpacity>
        <Text style={ui.navTitle} numberOfLines={1}>
          {title}
        </Text>
        {gameMeta ? (
          <View style={ui.navMeta}>
            <Text style={[ui.navLevel, { color: gameMeta.accentColor }]}>
              {gameMeta.levelPrefix ?? 'Lv'} {gameMeta.level}/{gameMeta.total}
            </Text>
            <Text style={[ui.navPts, { color: gameMeta.accentColor }]}>
              +{POINTS_PER_CORRECT_LEVEL} pts
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={ui.pageHeader}>
      <Text style={ui.pageTitle}>Games</Text>
      <Text style={ui.pageSubtitle}>{subtitle}</Text>
    </View>
  );
}

function GameLogosStrip({ size = 30 }: { size?: number }) {
  return (
    <View style={ui.logosStrip}>
      {GAMES.map((game, index) => (
        <View
          key={game.id}
          style={[
            ui.logoCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: index === 0 ? 0 : -(size * 0.22),
              borderColor: game.color,
              zIndex: GAMES.length - index,
            },
          ]}
        >
          <Image
            source={{ uri: game.imageUrl }}
            style={{ width: size - 8, height: size - 8 }}
            contentFit="contain"
          />
        </View>
      ))}
    </View>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <Text style={ui.sectionTitle}>{title}</Text>;
}

function ScoreBoard({ points }: { points: number }) {
  return (
    <View style={ui.scoreHero}>
      <LinearGradient
        colors={['#FFFFFF', '#FFF8F8', '#FFEFEF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ui.scoreHeroGradient}
      >
        <View style={ui.scoreHeroTop}>
          <View>
            <Text style={ui.scoreHeroLabel}>Your score</Text>
            <View style={ui.scoreHeroRow}>
              <Text style={ui.scoreHeroPoints}>{points.toLocaleString()}</Text>
              <Text style={ui.scoreHeroUnit}>pts</Text>
            </View>
          </View>
          <View style={ui.scoreHeroIcon}>
            <Image source={{ uri: SCORE_TROPHY_LOGO }} style={ui.scoreBoardIcon} contentFit="contain" />
          </View>
        </View>
        <View style={ui.scoreHeroDivider} />
        <GameLogosStrip size={28} />
      </LinearGradient>
    </View>
  );
}

function GameCard({
  game,
  savedLevel,
  onPress,
}: {
  game: (typeof GAMES)[0];
  savedLevel: number;
  onPress: () => void;
}) {
  const hasProgress = savedLevel > 0;
  return (
    <TouchableOpacity
      style={[ui.gameCard, cardShadow, { width: GAME_CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[ui.gameCardHero, { backgroundColor: game.heroBg }]}>
        <Image
          source={{ uri: game.imageUrl }}
          style={ui.gameCardImage}
          contentFit="contain"
          transition={200}
        />
        {hasProgress && (
          <View style={[ui.gameCardBadge, { backgroundColor: game.color }]}>
            <Text style={ui.gameCardBadgeText}>Lv {savedLevel + 1}</Text>
          </View>
        )}
      </View>
      <View style={ui.gameCardBody}>
        <Text style={ui.gameCardTitle} numberOfLines={2}>
          {game.title}
        </Text>
        <Text style={ui.gameCardDesc} numberOfLines={2}>
          {game.desc}
        </Text>
        <View style={[ui.gameCardCta, { backgroundColor: game.color }]}>
          <Text style={ui.gameCardCtaText}>
            {hasProgress ? 'Continue' : 'Play'}
          </Text>
          <Feather name="arrow-right" size={14} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GameLoading({ color }: { color: string }) {
  return (
    <View style={[gs.mcqGameContainer, gs.loadingBox]}>
      <ActivityIndicator size="large" color={color} />
      <Text style={gs.loadingText}>Loading your progress…</Text>
    </View>
  );
}

function scoreEmoji(score: number, total: number) {
  const pct = score / total;
  if (pct >= 0.8) return '🎉';
  if (pct >= 0.5) return '👍';
  return '😅';
}

function WrongAnswerHint({ correctText, explanation }: { correctText: string; explanation: string }) {
  return (
    <View style={gs.explainBox}>
      <Text style={gs.explainCorrect}>
        ✓ Correct: <Text style={gs.explainBold}>{correctText}</Text>
      </Text>
      <Text style={gs.explainDetail}>{shortExplanation(explanation)}</Text>
    </View>
  );
}

function NextLevelButton({
  onPress,
  color,
  isLast,
}: {
  onPress: () => void;
  color: string;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity style={[gs.nextBtn, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={gs.doneBtnText}>{isLast ? 'Finish' : 'Next'}</Text>
      <Feather name="arrow-right" size={20} color="#fff" />
    </TouchableOpacity>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function scrambleWord(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/** Shuffle MCQ options so the correct answer moves to a random position each level. */
function shuffleOptions(options: string[], correctIndex: number) {
  const items = options.map((text, i) => ({ text, isCorrect: i === correctIndex }));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  // If order unchanged (rare), swap first two so position always feels mixed
  if (items.length > 1 && items.every((item, i) => options[i] === item.text)) {
    [items[0], items[1]] = [items[1], items[0]];
  }
  return {
    options: items.map((item) => item.text),
    correctIndex: items.findIndex((item) => item.isCorrect),
  };
}

function McqRadio({
  checked,
  state,
}: {
  checked: boolean;
  state: 'idle' | 'selected' | 'correct' | 'wrong';
}) {
  const ringColor =
    state === 'correct'
      ? MCQ.correctBorder
      : state === 'wrong'
        ? MCQ.wrongBorder
        : checked
          ? MCQ.purple
          : MCQ.border;

  return (
    <View
      style={[
        gs.mcqRadioOuter,
        { borderColor: ringColor },
        checked && state !== 'wrong' && state !== 'correct' && gs.mcqRadioOuterSelected,
        state === 'correct' && gs.mcqRadioOuterCorrect,
        state === 'wrong' && gs.mcqRadioOuterWrong,
      ]}
    >
      {checked ? <View style={[gs.mcqRadioInner, state === 'correct' && { backgroundColor: MCQ.correctBorder }, state === 'wrong' && { backgroundColor: MCQ.wrongBorder }]} /> : null}
    </View>
  );
}

function getMcqOptionState(
  selected: number | null,
  index: number,
  correctIndex: number,
): 'idle' | 'selected' | 'correct' | 'wrong' {
  if (selected === null) return 'idle';
  if (index === correctIndex) return 'correct';
  if (index === selected) return 'wrong';
  return 'idle';
}

type AptitudeGameShellProps = {
  idx: number;
  total: number;
  levelLabel?: string;
  footerLabel: string;
  footerDisabled?: boolean;
  onFooterPress: () => void;
  children: React.ReactNode;
};

function AptitudeGameShell({
  idx,
  total,
  levelLabel = 'Question',
  footerLabel,
  footerDisabled = false,
  onFooterPress,
  children,
}: AptitudeGameShellProps) {
  const insets = useSafeAreaInsets();
  const progress = total > 0 ? (idx + 1) / total : 0;

  return (
    <View style={gs.mcqScreen}>
      <View style={gs.mcqProgressTrack}>
        <View style={[gs.mcqProgressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
      </View>

      <ScrollView
        style={gs.mcqScroll}
        contentContainerStyle={gs.mcqScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={gs.mcqQuestionLabel}>
          {levelLabel} {idx + 1} of {total}
        </Text>
        {children}
      </ScrollView>

      <View style={[gs.mcqFooter, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TouchableOpacity
          style={[gs.mcqNextBtn, footerDisabled && gs.mcqNextBtnDisabled]}
          onPress={onFooterPress}
          disabled={footerDisabled}
          activeOpacity={0.85}
        >
          <Text style={gs.mcqNextBtnText}>{footerLabel}</Text>
          <Feather name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

type McqGameplayProps = {
  accentColor: string;
  idx: number;
  total: number;
  question: string;
  shuffled: { options: string[]; correctIndex: number };
  selected: number | null;
  onPick: (i: number) => void;
  isCorrect: boolean;
  correctText: string;
  explanation: string;
  onNext: () => void;
  isLastLevel: boolean;
};

function McqGameplay({
  accentColor: _accentColor,
  idx,
  total,
  question,
  shuffled,
  selected,
  onPick,
  isCorrect,
  correctText,
  explanation,
  onNext,
  isLastLevel,
}: McqGameplayProps) {
  return (
    <AptitudeGameShell
      idx={idx}
      total={total}
      footerLabel={isLastLevel ? 'Finish' : 'Next'}
      footerDisabled={selected === null}
      onFooterPress={onNext}
    >
      <Text style={gs.mcqQuestionText}>{question}</Text>

      <View style={gs.mcqOptionsBlock}>
        {shuffled.options.map((opt, i) => {
          const state = getMcqOptionState(selected, i, shuffled.correctIndex);
          const isChosen = selected === i;
          const showResult = selected !== null;

          return (
            <TouchableOpacity
              key={`${idx}-${i}-${opt}`}
              style={[
                gs.mcqOptionCard,
                isChosen && selected !== null && !showResult && gs.mcqOptionCardSelected,
                state === 'correct' && gs.mcqOptionCardCorrect,
                state === 'wrong' && gs.mcqOptionCardWrong,
              ]}
              onPress={() => onPick(i)}
              disabled={selected !== null}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  gs.mcqOptionText,
                  (isChosen || state === 'correct') && gs.mcqOptionTextActive,
                ]}
              >
                {opt}
              </Text>
              <McqRadio
                checked={isChosen || state === 'correct'}
                state={showResult ? state : isChosen ? 'selected' : 'idle'}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {selected !== null && !isCorrect ? (
        <View style={gs.mcqHintBox}>
          <Text style={gs.mcqHintCorrect}>
            Correct: <Text style={gs.mcqHintBold}>{correctText}</Text>
          </Text>
          <Text style={gs.mcqHintDetail}>{shortExplanation(explanation)}</Text>
        </View>
      ) : null}

      {selected !== null && isCorrect ? (
        <Text style={gs.mcqCorrectBanner}>
          Correct · +{POINTS_PER_CORRECT_LEVEL} pts
        </Text>
      ) : null}
    </AptitudeGameShell>
  );
}

type ScrambleGameplayProps = {
  idx: number;
  total: number;
  hint: string;
  scrambled: string;
  input: string;
  onChangeInput: (text: string) => void;
  result: 'correct' | 'wrong' | null;
  correctWord: string;
  onCheck: () => void;
  onNext: () => void;
  isLastLevel: boolean;
};

function ScrambleGameplay({
  idx,
  total,
  hint,
  scrambled,
  input,
  onChangeInput,
  result,
  correctWord,
  onCheck,
  onNext,
  isLastLevel,
}: ScrambleGameplayProps) {
  const canCheck = input.trim().length > 0 && result === null;
  const footerLabel = result === null ? 'Check' : isLastLevel ? 'Finish' : 'Next';
  const onFooterPress = result === null ? onCheck : onNext;

  return (
    <AptitudeGameShell
      idx={idx}
      total={total}
      levelLabel="Level"
      footerLabel={footerLabel}
      footerDisabled={result === null && !canCheck}
      onFooterPress={onFooterPress}
    >
      <Text style={gs.mcqScrambleHint}>{hint}</Text>
      <Text style={gs.mcqScrambleWord}>{scrambled}</Text>

      <TextInput
        style={[
          gs.mcqTextInput,
          result === 'correct' && gs.mcqTextInputCorrect,
          result === 'wrong' && gs.mcqTextInputWrong,
        ]}
        value={input}
        onChangeText={onChangeInput}
        placeholder="Type the word..."
        autoCapitalize="characters"
        placeholderTextColor={UI.textTertiary}
        editable={result === null}
      />

      {result === 'wrong' ? (
        <View style={gs.mcqHintBox}>
          <Text style={gs.mcqHintCorrect}>
            Correct: <Text style={gs.mcqHintBold}>{correctWord}</Text>
          </Text>
          <Text style={gs.mcqHintDetail}>{hint}</Text>
        </View>
      ) : null}

      {result === 'correct' ? (
        <Text style={gs.mcqCorrectBanner}>
          Correct · +{POINTS_PER_CORRECT_LEVEL} pts
        </Text>
      ) : null}
    </AptitudeGameShell>
  );
}

type FlashcardGameplayProps = {
  idx: number;
  total: number;
  word: string;
  meaning: string;
  example: string;
  flipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  isLastLevel: boolean;
};

function FlashcardGameplay({
  idx,
  total,
  word,
  meaning,
  example,
  flipped,
  onFlip,
  onNext,
  isLastLevel,
}: FlashcardGameplayProps) {
  return (
    <AptitudeGameShell
      idx={idx}
      total={total}
      levelLabel="Card"
      footerLabel={isLastLevel ? 'Finish' : 'Next'}
      onFooterPress={onNext}
    >
      <TouchableOpacity
        style={gs.mcqFlashCard}
        onPress={onFlip}
        activeOpacity={0.92}
      >
        <Text style={gs.mcqFlashLabel}>{flipped ? 'Meaning' : 'Word'}</Text>
        <Text style={gs.mcqFlashMain}>{flipped ? meaning : word}</Text>
        {flipped ? (
          <Text style={gs.mcqFlashExample}>&quot;{example}&quot;</Text>
        ) : (
          <Text style={gs.mcqFlashTap}>Tap to reveal meaning</Text>
        )}
      </TouchableOpacity>
    </AptitudeGameShell>
  );
}

// ─── Quiz Game ────────────────────────────────────────────────────────────────
function QuizGame({
  onClose,
  onScore,
  onHeaderMeta,
}: {
  onClose: () => void;
  onScore: (n: number) => void;
  onHeaderMeta?: (meta: GameHeaderMeta | null) => void;
}) {
  const { idx, setIdx, score, setScore, ready, completeGame } = useGameProgress('quiz', QUIZ_QUESTIONS.length);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const finishAndClose = async () => {
    await completeGame();
    onClose();
  };

  const q = QUIZ_QUESTIONS[idx];
  const shuffled = React.useMemo(
    () => shuffleOptions(q.options, q.answer),
    [idx, q.options, q.answer],
  );

  useSyncGameHeader(
    onHeaderMeta,
    ready && !done
      ? { level: idx + 1, total: QUIZ_QUESTIONS.length, accentColor: '#e60000' }
      : null,
  );

  if (!ready) return <GameLoading color={MCQ.purple} />;

  const isCorrect = selected !== null && selected === shuffled.correctIndex;
  const isLastLevel = idx + 1 >= QUIZ_QUESTIONS.length;
  const correctText = shuffled.options[shuffled.correctIndex];

  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    const correct = i === shuffled.correctIndex;
    recordGameAnswer('quiz', correct);
    if (correct) {
      setScore(score + 1);
      onScore(POINTS_PER_CORRECT_LEVEL);
    }
  };

  const goNext = () => {
    if (idx + 1 < QUIZ_QUESTIONS.length) {
      setIdx(idx + 1);
      setSelected(null);
    } else {
      setDone(true);
    }
  };

  return (
    <View style={gs.mcqGameContainer}>
      {done ? (
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>{scoreEmoji(score, QUIZ_QUESTIONS.length)}</Text>
          <Text style={gs.doneTitle}>Quiz Complete!</Text>
          <Text style={gs.doneScore}>
            {score * POINTS_PER_CORRECT_LEVEL} pts · {score} / {QUIZ_QUESTIONS.length} correct
          </Text>
          <TouchableOpacity style={gs.mcqDoneBtn} onPress={finishAndClose}>
            <Text style={gs.doneBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <McqGameplay
          accentColor="#e60000"
          idx={idx}
          total={QUIZ_QUESTIONS.length}
          question={q.q}
          shuffled={shuffled}
          selected={selected}
          onPick={pick}
          isCorrect={isCorrect}
          correctText={correctText}
          explanation={getQuizExplanation(q)}
          onNext={goNext}
          isLastLevel={isLastLevel}
        />
      )}
    </View>
  );
}

// ─── Scramble Game ────────────────────────────────────────────────────────────
function ScrambleGame({
  onClose,
  onScore,
  onHeaderMeta,
}: {
  onClose: () => void;
  onScore: (n: number) => void;
  onHeaderMeta?: (meta: GameHeaderMeta | null) => void;
}) {
  const { idx, setIdx, score, setScore, ready, completeGame } = useGameProgress('scramble', WORD_SCRAMBLES.length);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const scrambled = React.useMemo(() => scrambleWord(WORD_SCRAMBLES[idx].word), [idx]);

  const finishAndClose = async () => {
    await completeGame();
    onClose();
  };

  useSyncGameHeader(
    onHeaderMeta,
    ready && !done
      ? { level: idx + 1, total: WORD_SCRAMBLES.length, accentColor: '#6C5CE7' }
      : null,
  );

  if (!ready) return <GameLoading color={MCQ.purple} />;

  const item = WORD_SCRAMBLES[idx];
  const isLastLevel = idx + 1 >= WORD_SCRAMBLES.length;

  const check = () => {
    if (result !== null) return;
    const correct = input.trim().toUpperCase() === item.word;
    setResult(correct ? 'correct' : 'wrong');
    recordGameAnswer('scramble', correct);
    if (correct) {
      setScore(score + 1);
      onScore(POINTS_PER_CORRECT_LEVEL);
    }
  };

  const goNext = () => {
    if (idx + 1 < WORD_SCRAMBLES.length) {
      setIdx(idx + 1);
      setInput('');
      setResult(null);
    } else {
      setDone(true);
    }
  };

  return (
    <View style={gs.mcqGameContainer}>
      {done ? (
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>{scoreEmoji(score, WORD_SCRAMBLES.length)}</Text>
          <Text style={gs.doneTitle}>Scramble Complete!</Text>
          <Text style={gs.doneScore}>
            {score * POINTS_PER_CORRECT_LEVEL} pts · {score} / {WORD_SCRAMBLES.length} correct
          </Text>
          <TouchableOpacity style={gs.mcqDoneBtn} onPress={finishAndClose}>
            <Text style={gs.doneBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrambleGameplay
          idx={idx}
          total={WORD_SCRAMBLES.length}
          hint={item.hint}
          scrambled={scrambled}
          input={input}
          onChangeInput={setInput}
          result={result}
          correctWord={item.word}
          onCheck={check}
          onNext={goNext}
          isLastLevel={isLastLevel}
        />
      )}
    </View>
  );
}

// ─── Fill Blanks Game ─────────────────────────────────────────────────────────
function FillBlanksGame({
  onClose,
  onScore,
  onHeaderMeta,
}: {
  onClose: () => void;
  onScore: (n: number) => void;
  onHeaderMeta?: (meta: GameHeaderMeta | null) => void;
}) {
  const { idx, setIdx, score, setScore, ready, completeGame } = useGameProgress('fill', FILL_BLANKS.length);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const finishAndClose = async () => {
    await completeGame();
    onClose();
  };

  const q = FILL_BLANKS[idx];
  const shuffled = React.useMemo(
    () => shuffleOptions(q.options, q.answer),
    [idx, q.options, q.answer],
  );

  useSyncGameHeader(
    onHeaderMeta,
    ready && !done
      ? { level: idx + 1, total: FILL_BLANKS.length, accentColor: '#00b894' }
      : null,
  );

  if (!ready) return <GameLoading color={MCQ.purple} />;

  const isCorrect = selected !== null && selected === shuffled.correctIndex;
  const isLastLevel = idx + 1 >= FILL_BLANKS.length;
  const correctText = shuffled.options[shuffled.correctIndex];

  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    const correct = i === shuffled.correctIndex;
    recordGameAnswer('fill', correct);
    if (correct) {
      setScore(score + 1);
      onScore(POINTS_PER_CORRECT_LEVEL);
    }
  };

  const goNext = () => {
    if (idx + 1 < FILL_BLANKS.length) {
      setIdx(idx + 1);
      setSelected(null);
    } else {
      setDone(true);
    }
  };

  return (
    <View style={gs.mcqGameContainer}>
      {done ? (
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>{scoreEmoji(score, FILL_BLANKS.length)}</Text>
          <Text style={gs.doneTitle}>All Levels Complete!</Text>
          <Text style={gs.doneScore}>
            {score * POINTS_PER_CORRECT_LEVEL} pts · {score} / {FILL_BLANKS.length} correct
          </Text>
          <TouchableOpacity style={gs.mcqDoneBtn} onPress={finishAndClose}>
            <Text style={gs.doneBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <McqGameplay
          accentColor="#00b894"
          idx={idx}
          total={FILL_BLANKS.length}
          question={q.sentence}
          shuffled={shuffled}
          selected={selected}
          onPick={pick}
          isCorrect={isCorrect}
          correctText={correctText}
          explanation={q.rule}
          onNext={goNext}
          isLastLevel={isLastLevel}
        />
      )}
    </View>
  );
}

// ─── Flashcard Game ───────────────────────────────────────────────────────────
function FlashcardGame({
  onClose,
  onHeaderMeta,
}: {
  onClose: () => void;
  onHeaderMeta?: (meta: GameHeaderMeta | null) => void;
}) {
  const { idx, setIdx, ready, completeGame } = useGameProgress('flash', FLASHCARDS.length);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  useSyncGameHeader(
    onHeaderMeta,
    ready && !done
      ? {
          level: idx + 1,
          total: FLASHCARDS.length,
          accentColor: '#0984e3',
          levelPrefix: 'Card',
        }
      : null,
  );

  const finishAndClose = async () => {
    await completeGame();
    onClose();
  };

  if (!ready) return <GameLoading color={MCQ.purple} />;

  const card = FLASHCARDS[idx];
  const isLastLevel = idx + 1 >= FLASHCARDS.length;

  const next = () => {
    setFlipped(false);
    if (idx + 1 < FLASHCARDS.length) {
      setIdx(idx + 1);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <View style={gs.mcqGameContainer}>
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>🎉</Text>
          <Text style={gs.doneTitle}>Flashcards Complete!</Text>
          <Text style={gs.doneScore}>You reviewed all {FLASHCARDS.length} cards</Text>
          <TouchableOpacity style={gs.mcqDoneBtn} onPress={finishAndClose}>
            <Text style={gs.doneBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={gs.mcqGameContainer}>
      <FlashcardGameplay
        idx={idx}
        total={FLASHCARDS.length}
        word={card.word}
        meaning={card.meaning}
        example={card.example}
        flipped={flipped}
        onFlip={() => setFlipped(!flipped)}
        onNext={next}
        isLastLevel={isLastLevel}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function GamesScreen() {
  const { setHideTabBar } = useGameTabBar();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [gameHeaderMeta, setGameHeaderMeta] = useState<GameHeaderMeta | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [savedProgress, setSavedProgress] = useState<Record<GameId, GameProgress> | null>(null);

  useFocusEffect(
    useCallback(() => {
      setHideTabBar(!!activeGame);
      return () => setHideTabBar(false);
    }, [activeGame, setHideTabBar]),
  );

  useEffect(() => {
    if (!activeGame) setGameHeaderMeta(null);
  }, [activeGame]);

  useEffect(() => {
    if (!activeGame) {
      loadAllGameProgress().then(setSavedProgress);
    }
  }, [activeGame]);

  const refreshScores = useCallback(async () => {
    loadAllGameProgress().then(setSavedProgress);
    setTotalScore(await getTotalGameScore());
  }, []);

  useEffect(() => {
    refreshScores();
  }, [refreshScores]);

  useFocusEffect(
    useCallback(() => {
      refreshScores();
    }, [refreshScores])
  );

  const handleScore = async (points: number) => {
    if (points <= 0) return;
    try {
      const current = await getTotalGameScore();
      const next = current + points;
      await setTotalGameScore(next);
      setTotalScore(next);
    } catch (e) {
      console.error('Failed to save game score', e);
    }
  };

  const closeGame = () => {
    setActiveGame(null);
    setGameHeaderMeta(null);
  };

  const renderGame = () => {
    const headerProps = { onHeaderMeta: setGameHeaderMeta };
    if (activeGame === 'quiz') {
      return <QuizGame onClose={closeGame} onScore={handleScore} {...headerProps} />;
    }
    if (activeGame === 'scramble') {
      return <ScrambleGame onClose={closeGame} onScore={handleScore} {...headerProps} />;
    }
    if (activeGame === 'fill') {
      return <FillBlanksGame onClose={closeGame} onScore={handleScore} {...headerProps} />;
    }
    if (activeGame === 'flash') {
      return <FlashcardGame onClose={closeGame} {...headerProps} />;
    }
    return null;
  };

  const activeTitle = GAMES.find((g) => g.id === activeGame)?.title ?? '';
  const isAptitudeGame = !!activeGame;

  const scrollBottom = tabBarHeight + 24;

  return (
    <View style={[ui.root, isAptitudeGame && ui.rootMcq]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={isAptitudeGame ? MCQ.bg : UI.bg}
      />
      <SafeAreaView edges={['top']} style={[ui.safeTop, isAptitudeGame && ui.safeTopMcq]} />
      {activeGame ? (
        <View style={[ui.screen, ui.screenMcq]}>
          <GamesHeader
            title={activeTitle}
            subtitle=""
            onBack={closeGame}
            gameMeta={gameHeaderMeta}
            aptitudeStyle
          />
          <View style={ui.mcqGameBody}>{renderGame()}</View>
        </View>
      ) : (
        <ScrollView
          style={ui.scrollBody}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ui.scroll, { paddingBottom: scrollBottom }]}
        >
          <View style={ui.content}>
            <GamesHeader
              title="Games"
              subtitle="Play and improve your English skills"
            />
            <ScoreBoard points={totalScore} />

            <View style={ui.gamesSection}>
              <SectionHeading title="Choose a game" />
              <View style={ui.gamesGrid}>
                {[0, 1].map((rowIndex) => (
                  <View key={rowIndex} style={ui.gamesRow}>
                    {GAMES.slice(rowIndex * 2, rowIndex * 2 + 2).map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        savedLevel={savedProgress?.[game.id]?.level ?? 0}
                        onPress={() => setActiveGame(game.id)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>

            <View style={[ui.tipCard, cardShadow]}>
              <View style={ui.tipIconWrap}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={UI.accent} />
              </View>
              <Text style={ui.tipText}>
                Play daily to earn points and climb the Leaderboard.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Shared Game Styles ───────────────────────────────────────────────────────
const gs = StyleSheet.create({
  gameContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 4, backgroundColor: UI.bg },
  mcqGameContainer: { flex: 1, backgroundColor: MCQ.bg },
  mcqScreen: { flex: 1, backgroundColor: MCQ.bg },
  mcqProgressTrack: {
    height: 4,
    backgroundColor: MCQ.purpleTrack,
    width: '100%',
  },
  mcqProgressFill: {
    height: '100%',
    backgroundColor: MCQ.purple,
    borderRadius: 2,
  },
  mcqScroll: { flex: 1 },
  mcqScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  mcqQuestionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: MCQ.purple,
    marginBottom: 12,
  },
  mcqQuestionText: {
    fontSize: 22,
    fontWeight: '700',
    color: UI.text,
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: 28,
  },
  mcqOptionsBlock: { gap: 12 },
  mcqOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: MCQ.bg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: MCQ.border,
    paddingVertical: 18,
    paddingHorizontal: 18,
    minHeight: 60,
  },
  mcqOptionCardSelected: {
    backgroundColor: MCQ.purpleLight,
    borderColor: MCQ.purple,
  },
  mcqOptionCardCorrect: {
    backgroundColor: MCQ.correctBg,
    borderColor: MCQ.correctBorder,
  },
  mcqOptionCardWrong: {
    backgroundColor: MCQ.wrongBg,
    borderColor: MCQ.wrongBorder,
  },
  mcqOptionText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: UI.text,
    paddingRight: 12,
  },
  mcqOptionTextActive: { fontWeight: '600' },
  mcqRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mcqRadioOuterSelected: {
    borderColor: MCQ.purple,
    backgroundColor: MCQ.purple,
  },
  mcqRadioOuterCorrect: {
    borderColor: MCQ.correctBorder,
    backgroundColor: MCQ.correctBorder,
  },
  mcqRadioOuterWrong: {
    borderColor: MCQ.wrongBorder,
    backgroundColor: MCQ.wrongBorder,
  },
  mcqRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  mcqHintBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: MCQ.purpleLight,
  },
  mcqHintCorrect: { fontSize: 14, fontWeight: '600', color: UI.text, marginBottom: 6 },
  mcqHintBold: { fontWeight: '700', color: MCQ.correctBorder },
  mcqHintDetail: { fontSize: 14, color: UI.textSecondary, lineHeight: 21 },
  mcqCorrectBanner: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
    color: MCQ.correctBorder,
    textAlign: 'center',
  },
  mcqFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: MCQ.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MCQ.border,
  },
  mcqNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#101010',
    borderRadius: 14,
    paddingVertical: 17,
    minHeight: 56,
  },
  mcqNextBtnDisabled: { opacity: 0.35 },
  mcqNextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  mcqScrambleHint: {
    fontSize: 15,
    fontWeight: '600',
    color: MCQ.purple,
    marginBottom: 8,
  },
  mcqScrambleWord: {
    fontSize: 32,
    fontWeight: '800',
    color: UI.text,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 28,
  },
  mcqTextInput: {
    borderWidth: 1.5,
    borderColor: MCQ.border,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: UI.text,
    backgroundColor: MCQ.bg,
    minHeight: 60,
  },
  mcqTextInputCorrect: {
    backgroundColor: MCQ.correctBg,
    borderColor: MCQ.correctBorder,
  },
  mcqTextInputWrong: {
    backgroundColor: MCQ.wrongBg,
    borderColor: MCQ.wrongBorder,
  },
  mcqFlashCard: {
    backgroundColor: MCQ.bg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: MCQ.purple,
    minHeight: 220,
    paddingVertical: 32,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  mcqFlashLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: MCQ.purple,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  mcqFlashMain: {
    fontSize: 28,
    fontWeight: '800',
    color: UI.text,
    textAlign: 'center',
    lineHeight: 36,
  },
  mcqFlashExample: {
    fontSize: 15,
    color: UI.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  mcqFlashTap: {
    fontSize: 14,
    color: UI.textTertiary,
    marginTop: 20,
    fontWeight: '500',
  },
  mcqDoneBtn: {
    backgroundColor: '#101010',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    alignSelf: 'center',
  },
  loadingBox: { justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  loadingText: { marginTop: 12, fontSize: 14, color: UI.textSecondary, fontWeight: '500' },
  questionCard: {
    backgroundColor: UI.surface,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    justifyContent: 'center',
    minHeight: 108,
  },
  optionsBlock: { marginBottom: 8 },
  feedbackCard: {
    backgroundColor: UI.surface,
    borderRadius: 20,
    padding: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  answerFeedback: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  answerCorrect: { color: '#00b894' },
  answerWrong: { color: UI.accent },
  explainBox: {
    backgroundColor: UI.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  explainCorrect: { fontSize: 14, fontWeight: '700', color: UI.text, marginBottom: 6 },
  explainBold: { color: '#00b894' },
  explainDetail: { fontSize: 14, color: UI.textSecondary, lineHeight: 22 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 14,
    width: '100%',
    minHeight: 52,
  },
  progressWrap: { marginBottom: 4 },
  progressTrack: {
    height: 8,
    backgroundColor: UI.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  questionNum: { fontSize: 14, color: UI.textSecondary, fontWeight: '500', textAlign: 'center' },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: UI.text,
    lineHeight: 30,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  hintText: {
    fontSize: 14,
    color: UI.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrambledWord: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6C5CE7',
    textAlign: 'center',
    letterSpacing: 6,
  },
  scrambleInput: {
    borderWidth: 1,
    borderColor: UI.divider,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: UI.text,
    backgroundColor: UI.surface,
    marginBottom: 12,
  },
  scrambleInputCorrect: { borderColor: '#A5D6A7', backgroundColor: '#E8F5E9' },
  scrambleInputWrong: { borderColor: '#FFCDD2', backgroundColor: '#FFEBEE' },
  optionBtn: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.divider,
    minHeight: 56,
    justifyContent: 'center',
    ...cardShadow,
  },
  optionBtnCorrect: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  optionBtnWrong: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  optionBtnDimmed: { opacity: 0.45 },
  optionText: { fontSize: 17, fontWeight: '600', color: UI.text, textAlign: 'center' },
  flashcard: { borderRadius: 24, overflow: 'hidden', marginBottom: 24, height: 220 },
  flashcardInner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  flashcardLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 },
  flashcardWord: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12 },
  flashcardExample: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
  flashcardTap: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 16 },
  flashNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  flashNavBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  flashNavBtnDisabled: { opacity: 0.5 },
  flashNavLabel: { fontSize: 14, fontWeight: '700', color: '#666' },
  doneBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: UI.surface,
    borderRadius: 24,
    marginVertical: 16,
    ...cardShadow,
  },
  doneEmoji: { fontSize: 60, marginBottom: 16 },
  doneTitle: { fontSize: 28, fontWeight: '800', color: UI.text, marginBottom: 8 },
  doneScore: { fontSize: 18, fontWeight: '600', color: UI.textSecondary, marginBottom: 32 },
  doneBtn: { backgroundColor: UI.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 22, alignSelf: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

// ─── Screen UI (Samsung One UI, matches Rewards / Performance) ─────────────────
const ui = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.bg,
  },
  rootMcq: { backgroundColor: MCQ.bg },
  safeTop: {
    backgroundColor: UI.bg,
  },
  safeTopMcq: { backgroundColor: MCQ.bg },
  screen: { flex: 1 },
  screenMcq: { backgroundColor: MCQ.bg },
  mcqGameBody: { flex: 1, backgroundColor: MCQ.bg },
  aptitudeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: MCQ.bg,
  },
  aptitudeBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: MCQ.purpleLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aptitudeHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: UI.text,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginHorizontal: 8,
  },
  aptitudeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 56,
    justifyContent: 'flex-end',
  },
  aptitudeHeaderRightPlaceholder: { width: 56 },
  aptitudeHeaderTimer: {
    fontSize: 15,
    fontWeight: '600',
    color: UI.text,
  },
  scrollBody: { flex: 1, backgroundColor: UI.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: UI.bg,
    gap: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.3,
    minWidth: 0,
    marginRight: 6,
  },
  navMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  navLevel: {
    fontSize: 14,
    fontWeight: '700',
  },
  navPts: {
    fontSize: 14,
    fontWeight: '700',
  },
  pageHeader: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: UI.text,
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: UI.textSecondary,
    marginTop: 6,
    lineHeight: 22,
  },
  scroll: { flexGrow: 1 },
  gameScroll: { flexGrow: 1, paddingHorizontal: 0 },
  content: { paddingHorizontal: 20 },
  scoreHero: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    ...cardShadow,
  },
  scoreHeroGradient: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: UI.divider,
  },
  scoreHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreHeroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  scoreHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scoreHeroPoints: {
    fontSize: 36,
    fontWeight: '800',
    color: UI.text,
    letterSpacing: -1,
  },
  scoreHeroUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: UI.textTertiary,
  },
  scoreHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: UI.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBoardIcon: {
    width: 32,
    height: 32,
  },
  scoreHeroDivider: {
    height: 1,
    backgroundColor: UI.divider,
    marginVertical: 14,
  },
  logosStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    backgroundColor: UI.surface,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  gamesSection: { marginBottom: 20 },
  gamesGrid: {
    gap: GAME_GRID_GAP,
  },
  gamesRow: {
    flexDirection: 'row',
    gap: GAME_GRID_GAP,
  },
  gameCard: {
    backgroundColor: UI.surface,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.divider,
  },
  gameCardHero: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gameCardImage: {
    width: 60,
    height: 60,
  },
  gameCardBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gameCardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gameCardBody: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  gameCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  gameCardTitleLogo: {
    width: 24,
    height: 24,
  },
  gameCardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: UI.text,
  },
  gameCardDesc: {
    fontSize: 11,
    color: UI.textSecondary,
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 8,
  },
  gameCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
  },
  gameCardCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: UI.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: UI.divider,
    marginBottom: 8,
  },
  tipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: UI.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: UI.textSecondary,
    lineHeight: 21,
  },
});
