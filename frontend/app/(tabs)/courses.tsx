import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Platform, StatusBar, Dimensions,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
const GAME_CARD_WIDTH = (SCREEN_WIDTH - 14 * 2 - 12) / 2;

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

function GamesStickyHeader({
  insetsTop,
  title,
  subtitle,
  onBack,
}: {
  insetsTop: number;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <LinearGradient
      colors={['#FFD6D6', '#FFF0F0', '#F8F9FA']}
      locations={[0, 0.55, 1]}
      style={[ui.stickyHeader, { paddingTop: insetsTop }]}
    >
      <View style={ui.headerRow}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={ui.backBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={24} color="#1F1F1F" />
          </TouchableOpacity>
        ) : null}
        <View style={[ui.headerTextBlock, !onBack && ui.headerTextBlockMain]}>
          <Text style={ui.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={ui.headerSub}>{subtitle}</Text>
        </View>
      </View>
    </LinearGradient>
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

function SectionHeading({ title, inset }: { title: string; inset?: boolean }) {
  return (
    <View style={[ui.cardSectionHeader, inset && ui.cardSectionHeaderInset]}>
      <Text style={ui.cardSectionHeaderText}>{title}</Text>
      <View style={[ui.cardSectionHeaderLine, inset && ui.cardSectionHeaderLineInset]} />
    </View>
  );
}

function ScoreBoard({ points }: { points: number }) {
  return (
    <View style={ui.scoreBoardWrap}>
      <View style={ui.scoreBoard}>
        <Image source={{ uri: SCORE_TROPHY_LOGO }} style={ui.scoreBoardIcon} contentFit="contain" />
        <Text style={ui.scoreBoardLabel}>Your score</Text>
        <Text style={ui.scoreBoardPoints}>{points.toLocaleString()}</Text>
        <Text style={ui.scoreBoardUnit}>pts</Text>
      </View>
      <GameLogosStrip />
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
      style={[ui.gameCard, { width: GAME_CARD_WIDTH }]}
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
        <View style={ui.gameCardTitleRow}>
          <Image source={{ uri: game.imageUrl }} style={ui.gameCardTitleLogo} contentFit="contain" />
          <Text style={ui.gameCardTitle} numberOfLines={1}>{game.title}</Text>
        </View>
        <Text style={ui.gameCardDesc} numberOfLines={2}>{game.desc}</Text>
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
    <View style={[gs.gameContainer, gs.loadingBox]}>
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

function LevelProgress({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = Math.min(100, ((current + 1) / total) * 100);
  return (
    <View style={gs.progressWrap}>
      <View style={gs.progressTrack}>
        <View style={[gs.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={gs.questionNum}>Level {current + 1} of {total}</Text>
    </View>
  );
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

// ─── Quiz Game ────────────────────────────────────────────────────────────────
function QuizGame({ onClose, onScore }: { onClose: () => void; onScore: (n: number) => void }) {
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

  if (!ready) return <GameLoading color="#e60000" />;

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
    <View style={gs.gameContainer}>
      {done ? (
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>{scoreEmoji(score, QUIZ_QUESTIONS.length)}</Text>
          <Text style={gs.doneTitle}>Quiz Complete!</Text>
          <Text style={gs.doneScore}>
            {score * POINTS_PER_CORRECT_LEVEL} pts · {score} / {QUIZ_QUESTIONS.length} correct
          </Text>
          <TouchableOpacity style={gs.doneBtn} onPress={finishAndClose}>
            <Text style={gs.doneBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {idx > 0 && <Text style={gs.resumeHint}>Resuming from level {idx + 1}</Text>}
          <LevelProgress current={idx} total={QUIZ_QUESTIONS.length} color="#e60000" />
          <Text style={gs.pointsHint}>+{POINTS_PER_CORRECT_LEVEL} pts per correct answer</Text>
          <Text style={gs.questionText}>{q.q}</Text>
          {shuffled.options.map((opt, i) => {
            let bg = '#fff';
            if (selected !== null) {
              if (i === shuffled.correctIndex) bg = '#d4edda';
              else if (i === selected) bg = '#f8d7da';
            }
            return (
              <TouchableOpacity
                key={`${idx}-${i}-${opt}`}
                style={[gs.optionBtn, { backgroundColor: bg }, selected !== null && gs.optionDisabled]}
                onPress={() => pick(i)}
                disabled={selected !== null}
              >
                <Text style={gs.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {selected !== null && (
            <>
              <Text style={[gs.answerFeedback, isCorrect ? gs.answerCorrect : gs.answerWrong]}>
                {isCorrect
                  ? `✅ Correct! +${POINTS_PER_CORRECT_LEVEL} pts`
                  : '❌ Wrong · No points'}
              </Text>
              {!isCorrect && (
                <WrongAnswerHint
                  correctText={correctText}
                  explanation={getQuizExplanation(q)}
                />
              )}
              <NextLevelButton onPress={goNext} color="#e60000" isLast={isLastLevel} />
            </>
          )}
        </>
      )}
    </View>
  );
}

// ─── Scramble Game ────────────────────────────────────────────────────────────
function ScrambleGame({ onClose, onScore }: { onClose: () => void; onScore: (n: number) => void }) {
  const { idx, setIdx, score, setScore, ready, completeGame } = useGameProgress('scramble', WORD_SCRAMBLES.length);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const scrambled = React.useMemo(() => scrambleWord(WORD_SCRAMBLES[idx].word), [idx]);

  const finishAndClose = async () => {
    await completeGame();
    onClose();
  };

  if (!ready) return <GameLoading color="#6C5CE7" />;

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
    <View style={gs.gameContainer}>
      {done ? (
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>{scoreEmoji(score, WORD_SCRAMBLES.length)}</Text>
          <Text style={gs.doneTitle}>Scramble Complete!</Text>
          <Text style={gs.doneScore}>
            {score * POINTS_PER_CORRECT_LEVEL} pts · {score} / {WORD_SCRAMBLES.length} correct
          </Text>
          <TouchableOpacity style={gs.doneBtn} onPress={finishAndClose}><Text style={gs.doneBtnText}>Back to Games</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          {idx > 0 && <Text style={gs.resumeHint}>Resuming from level {idx + 1}</Text>}
          <LevelProgress current={idx} total={WORD_SCRAMBLES.length} color="#6C5CE7" />
          <Text style={gs.pointsHint}>+{POINTS_PER_CORRECT_LEVEL} pts per correct answer</Text>
          <Text style={gs.hintText}>💡 {item.hint}</Text>
          <Text style={gs.scrambledWord}>{scrambled}</Text>
          <TextInput
            style={[gs.scrambleInput, result === 'correct' && { borderColor: '#00b894' }, result === 'wrong' && { borderColor: '#e60000' }]}
            value={input}
            onChangeText={setInput}
            placeholder="Type the word..."
            autoCapitalize="characters"
            placeholderTextColor="#aaa"
            editable={result === null}
          />
          {result && (
            <>
              <Text style={[gs.answerFeedback, result === 'correct' ? gs.answerCorrect : gs.answerWrong]}>
                {result === 'correct'
                  ? `✅ Correct! +${POINTS_PER_CORRECT_LEVEL} pts`
                  : '❌ Wrong · No points'}
              </Text>
              {result === 'wrong' && (
                <WrongAnswerHint correctText={item.word} explanation={item.hint} />
              )}
              <NextLevelButton onPress={goNext} color="#6C5CE7" isLast={isLastLevel} />
            </>
          )}
          {result === null && (
            <TouchableOpacity style={[gs.doneBtn, { backgroundColor: '#6C5CE7', marginTop: 16 }]} onPress={check}>
              <Text style={gs.doneBtnText}>Check</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ─── Fill Blanks Game ─────────────────────────────────────────────────────────
function FillBlanksGame({ onClose, onScore }: { onClose: () => void; onScore: (n: number) => void }) {
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

  if (!ready) return <GameLoading color="#00b894" />;

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
    <View style={gs.gameContainer}>
      {done ? (
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>{scoreEmoji(score, FILL_BLANKS.length)}</Text>
          <Text style={gs.doneTitle}>All Levels Complete!</Text>
          <Text style={gs.doneScore}>
            {score * POINTS_PER_CORRECT_LEVEL} pts · {score} / {FILL_BLANKS.length} correct
          </Text>
          <TouchableOpacity style={gs.doneBtn} onPress={finishAndClose}><Text style={gs.doneBtnText}>Back to Games</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          {idx > 0 && <Text style={gs.resumeHint}>Resuming from level {idx + 1}</Text>}
          <LevelProgress current={idx} total={FILL_BLANKS.length} color="#00b894" />
          <Text style={gs.pointsHint}>+{POINTS_PER_CORRECT_LEVEL} pts per correct answer</Text>
          <Text style={gs.questionText}>{q.sentence}</Text>
          {shuffled.options.map((opt, i) => {
            let bg = '#fff';
            if (selected !== null) {
              if (i === shuffled.correctIndex) bg = '#d4edda';
              else if (i === selected) bg = '#f8d7da';
            }
            return (
              <TouchableOpacity
                key={`${idx}-${i}-${opt}`}
                style={[gs.optionBtn, { backgroundColor: bg }, selected !== null && gs.optionDisabled]}
                onPress={() => pick(i)}
                disabled={selected !== null}
              >
                <Text style={gs.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {selected !== null && (
            <>
              <Text style={[gs.answerFeedback, isCorrect ? gs.answerCorrect : gs.answerWrong]}>
                {isCorrect
                  ? `✅ Correct! +${POINTS_PER_CORRECT_LEVEL} pts`
                  : '❌ Wrong · No points'}
              </Text>
              {!isCorrect && (
                <WrongAnswerHint correctText={correctText} explanation={q.rule} />
              )}
              <NextLevelButton onPress={goNext} color="#00b894" isLast={isLastLevel} />
            </>
          )}
        </>
      )}
    </View>
  );
}

// ─── Flashcard Game ───────────────────────────────────────────────────────────
function FlashcardGame({ onClose }: { onClose: () => void }) {
  const { idx, setIdx, ready, completeGame } = useGameProgress('flash', FLASHCARDS.length);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const finishAndClose = async () => {
    await completeGame();
    onClose();
  };

  if (!ready) return <GameLoading color="#0984e3" />;

  const card = FLASHCARDS[idx];

  const next = () => {
    setFlipped(false);
    if (idx + 1 < FLASHCARDS.length) {
      setIdx(idx + 1);
    } else {
      setDone(true);
    }
  };
  const prev = () => {
    if (idx > 0) {
      setFlipped(false);
      setIdx(idx - 1);
    }
  };

  if (done) {
    return (
      <View style={gs.gameContainer}>
        <View style={gs.doneBox}>
          <Text style={gs.doneEmoji}>🎉</Text>
          <Text style={gs.doneTitle}>Flashcards Complete!</Text>
          <Text style={gs.doneScore}>You reviewed all {FLASHCARDS.length} cards</Text>
          <TouchableOpacity style={[gs.doneBtn, { backgroundColor: '#0984e3' }]} onPress={finishAndClose}>
            <Text style={gs.doneBtnText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={gs.gameContainer}>
      {idx > 0 && <Text style={gs.resumeHint}>Resuming from card {idx + 1}</Text>}
      <LevelProgress current={idx} total={FLASHCARDS.length} color="#0984e3" />
      <TouchableOpacity style={gs.flashcard} onPress={() => setFlipped(!flipped)} activeOpacity={0.9}>
        <LinearGradient colors={flipped ? ['#0984e3', '#74b9ff'] : ['#6C5CE7', '#a29bfe']} style={gs.flashcardInner}>
          <Text style={gs.flashcardLabel}>{flipped ? 'Meaning' : 'Word'}</Text>
          <Text style={gs.flashcardWord}>{flipped ? card.meaning : card.word}</Text>
          {flipped && <Text style={gs.flashcardExample}>"{card.example}"</Text>}
          {!flipped && <Text style={gs.flashcardTap}>Tap to reveal meaning</Text>}
        </LinearGradient>
      </TouchableOpacity>
      <View style={gs.flashNav}>
        <TouchableOpacity style={[gs.flashNavBtn, idx === 0 && gs.flashNavBtnDisabled]} onPress={prev} disabled={idx === 0}>
          <Feather name="chevron-left" size={24} color={idx === 0 ? '#ccc' : '#333'} />
        </TouchableOpacity>
        <Text style={gs.flashNavLabel}>{idx + 1 === FLASHCARDS.length ? 'Finish' : 'Next'}</Text>
        <TouchableOpacity style={gs.flashNavBtn} onPress={next}>
          <Feather name={idx + 1 === FLASHCARDS.length ? 'check' : 'chevron-right'} size={24} color="#333" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[gs.doneBtn, { backgroundColor: '#6C5CE7', marginTop: 8 }]} onPress={onClose}>
        <Text style={gs.doneBtnText}>Back to Games</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [savedProgress, setSavedProgress] = useState<Record<GameId, GameProgress> | null>(null);

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

  const renderGame = () => {
    if (activeGame === 'quiz') return <QuizGame onClose={() => setActiveGame(null)} onScore={handleScore} />;
    if (activeGame === 'scramble') return <ScrambleGame onClose={() => setActiveGame(null)} onScore={handleScore} />;
    if (activeGame === 'fill') return <FillBlanksGame onClose={() => setActiveGame(null)} onScore={handleScore} />;
    if (activeGame === 'flash') return <FlashcardGame onClose={() => setActiveGame(null)} />;
    return null;
  };

  const activeTitle = GAMES.find((g) => g.id === activeGame)?.title ?? '';

  return (
    <View style={ui.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFE8E8" />
      {activeGame ? (
        <View style={ui.screen}>
          <GamesStickyHeader
            insetsTop={insets.top}
            title={activeTitle}
            subtitle="English practice game"
            onBack={() => setActiveGame(null)}
          />
          <ScrollView
            style={ui.scrollBody}
            contentContainerStyle={ui.gameScroll}
            showsVerticalScrollIndicator={false}
          >
            {renderGame()}
          </ScrollView>
        </View>
      ) : (
        <View style={ui.screen}>
          <GamesStickyHeader
            insetsTop={insets.top}
            title="English Games"
            subtitle="Play and improve your English skills"
          />
          <ScrollView
            style={ui.scrollBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ui.scroll}
          >
            <View style={ui.content}>
              <ScoreBoard points={totalScore} />

              <View style={ui.gamesSection}>
                <SectionHeading title="Choose a game" />
                <View style={ui.gamesGrid}>
                  {GAMES.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      savedLevel={savedProgress?.[game.id]?.level ?? 0}
                      onPress={() => setActiveGame(game.id)}
                    />
                  ))}
                </View>
              </View>

              <View style={ui.tipCard}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#5F6368" />
                <Text style={ui.tipText}>
                  Play daily to earn points and climb the Leaderboard.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Shared Game Styles ───────────────────────────────────────────────────────
const gs = StyleSheet.create({
  gameContainer: { flex: 1, padding: 20, backgroundColor: '#F8F9FA' },
  loadingBox: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#888', fontWeight: '500' },
  resumeHint: { fontSize: 13, color: '#0984e3', fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  pointsHint: { fontSize: 12, color: '#00b894', fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  answerFeedback: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  answerCorrect: { color: '#00b894' },
  answerWrong: { color: '#e60000' },
  explainBox: {
    backgroundColor: '#FFF8E6',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA502',
  },
  explainCorrect: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  explainBold: { color: '#00b894' },
  explainDetail: { fontSize: 13, color: '#555', lineHeight: 20 },
  optionDisabled: { opacity: 0.85 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 16,
    width: '100%',
  },
  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 8, backgroundColor: '#e8e8e8', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  questionNum: { fontSize: 13, color: '#888', fontWeight: '600', textAlign: 'center' },
  questionText: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 24, lineHeight: 26 },
  hintText: { fontSize: 14, color: '#888', marginBottom: 12 },
  scrambledWord: { fontSize: 32, fontWeight: '900', color: '#6C5CE7', textAlign: 'center', letterSpacing: 8, marginBottom: 24 },
  scrambleInput: { borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 16, padding: 14, fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', backgroundColor: '#f8f8f8' },
  optionBtn: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  optionText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
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
  doneBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  doneEmoji: { fontSize: 60, marginBottom: 16 },
  doneTitle: { fontSize: 28, fontWeight: '900', color: '#1a1a1a', marginBottom: 8 },
  doneScore: { fontSize: 20, fontWeight: '700', color: '#666', marginBottom: 32 },
  doneBtn: { backgroundColor: '#e60000', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 20, alignSelf: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

// ─── Screen UI (Google-style, matches Performance / Leaderboard) ─────────────
const ui = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  screen: { flex: 1 },
  stickyHeader: {
    paddingBottom: 16,
    zIndex: 10,
  },
  scrollBody: { flex: 1, backgroundColor: '#F8F9FA' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: 16,
  },
  headerTextBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  headerTextBlockMain: {
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  headerSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5F6368',
    marginTop: 2,
    lineHeight: 20,
  },
  scroll: { paddingBottom: 32 },
  gameScroll: { flexGrow: 1, paddingBottom: 24 },
  content: { paddingHorizontal: 14, paddingTop: 4 },
  scoreBoardWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: '#E8EAED',
    gap: 6,
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  scoreBoardIcon: {
    width: 28,
    height: 28,
  },
  logosStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  logoCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scoreBoardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5F6368',
  },
  scoreBoardPoints: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: -0.3,
  },
  scoreBoardUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#80868B',
    marginTop: 2,
  },
  cardSectionHeader: {
    paddingTop: 2,
    paddingBottom: 0,
    marginBottom: 8,
  },
  cardSectionHeaderInset: {
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 0,
  },
  cardSectionHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5F6368',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cardSectionHeaderLine: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginBottom: 6,
  },
  cardSectionHeaderLineInset: { marginBottom: 4 },
  gamesSection: { marginBottom: 12 },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gameCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EAED',
    overflow: 'hidden',
    shadowColor: '#3C4043',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  gameCardHero: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gameCardImage: {
    width: 72,
    height: 72,
  },
  gameCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  gameCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gameCardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  gameCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  gameCardTitleLogo: {
    width: 22,
    height: 22,
  },
  gameCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  gameCardDesc: {
    fontSize: 11,
    color: '#5F6368',
    lineHeight: 15,
    minHeight: 30,
    marginBottom: 10,
  },
  gameCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  gameCardCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#5F6368',
    lineHeight: 20,
  },
});
