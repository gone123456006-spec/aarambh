import { FILL_BLANKS_DATA } from './grammarData';

export type QuizQuestion = { q: string; options: string[]; answer: number; explanation?: string };
export type WordScramble = { word: string; hint: string };
export type FillBlank = { sentence: string; options: string[]; answer: number; correctText: string; rule: string };

/** Trim long grammar tips for on-screen display after a wrong answer. */
export function shortExplanation(text: string, maxLen = 90): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 50 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

export function getQuizExplanation(q: QuizQuestion): string {
  const correct = q.options[q.answer];
  if (q.explanation) return shortExplanation(q.explanation);
  const wordMatch = q.q.match(/"([^"]+)"/);
  if (wordMatch) return `${wordMatch[1]} means "${correct}".`;
  if (q.q.startsWith('Choose the correct')) return `The right sentence is: "${correct}".`;
  return `The correct answer is "${correct}".`;
}
export type Flashcard = { word: string; meaning: string; example: string };

export const POINTS_PER_CORRECT_LEVEL = 5;

export const QUIZ_LEVEL_COUNT = 50;
export const SCRAMBLE_LEVEL_COUNT = 50;
export const FILL_BLANK_LEVEL_COUNT = 100;
export const FLASHCARD_LEVEL_COUNT = 50;

const VOCAB_QUIZ: QuizQuestion[] = [
  { q: 'What is the meaning of "Eloquent"?', options: ['Well spoken', 'Lazy', 'Angry', 'Tired'], answer: 0 },
  { q: 'What does "Persevere" mean?', options: ['Give up', 'Continue despite difficulty', 'Forget', 'Sleep'], answer: 1 },
  { q: 'Opposite of "Ancient" is?', options: ['Old', 'Modern', 'Historic', 'Classic'], answer: 1 },
  { q: '"Benevolent" means?', options: ['Kind and generous', 'Cruel', 'Cowardly', 'Greedy'], answer: 0 },
  { q: 'What is the meaning of "Articulate"?', options: ['Able to express clearly', 'Confused', 'Silent', 'Rude'], answer: 0 },
  { q: '"Diligent" means?', options: ['Hardworking', 'Careless', 'Slow', 'Noisy'], answer: 0 },
  { q: 'What does "Candid" mean?', options: ['Honest and direct', 'Secretive', 'Shy', 'Angry'], answer: 0 },
  { q: '"Resilient" means?', options: ['Able to recover quickly', 'Weak', 'Lazy', 'Forgetful'], answer: 0 },
  { q: 'What is the meaning of "Scrutinize"?', options: ['Examine closely', 'Ignore', 'Praise', 'Destroy'], answer: 0 },
  { q: '"Ambiguous" means?', options: ['Unclear or having multiple meanings', 'Very clear', 'Loud', 'Short'], answer: 0 },
  { q: 'What does "Concise" mean?', options: ['Brief and clear', 'Very long', 'Confusing', 'Angry'], answer: 0 },
  { q: '"Empathy" means?', options: ['Understanding others\' feelings', 'Selfishness', 'Fear', 'Joy'], answer: 0 },
  { q: 'Opposite of "Generous" is?', options: ['Stingy', 'Kind', 'Brave', 'Happy'], answer: 0 },
  { q: 'What is the meaning of "Meticulous"?', options: ['Very careful and precise', 'Careless', 'Fast', 'Lazy'], answer: 0 },
  { q: '"Innovative" means?', options: ['Introducing new ideas', 'Old-fashioned', 'Boring', 'Weak'], answer: 0 },
  { q: 'What does "Pragmatic" mean?', options: ['Practical and realistic', 'Dreamy', 'Emotional', 'Lazy'], answer: 0 },
  { q: '"Tenacious" means?', options: ['Persistent and determined', 'Weak', 'Shy', 'Quiet'], answer: 0 },
  { q: 'What is the meaning of "Versatile"?', options: ['Able to adapt to many uses', 'Limited', 'Slow', 'Weak'], answer: 0 },
  { q: '"Coherent" means?', options: ['Logical and consistent', 'Confusing', 'Loud', 'Short'], answer: 0 },
  { q: 'What does "Indifferent" mean?', options: ['Having no strong feeling', 'Very excited', 'Angry', 'Happy'], answer: 0 },
  { q: 'Opposite of "Expand" is?', options: ['Contract', 'Grow', 'Stretch', 'Increase'], answer: 0 },
  { q: '"Profound" means?', options: ['Very deep or intense', 'Shallow', 'Small', 'Quick'], answer: 0 },
  { q: 'What is the meaning of "Obsolete"?', options: ['No longer in use', 'Modern', 'Popular', 'New'], answer: 0 },
  { q: '"Authentic" means?', options: ['Genuine and real', 'Fake', 'Broken', 'Old'], answer: 0 },
  { q: 'What does "Eloquent" describe?', options: ['Fluent and persuasive speech', 'Poor writing', 'Silence', 'Noise'], answer: 0 },
  { q: '"Frugal" means?', options: ['Economical with money', 'Wasteful', 'Rich', 'Careless'], answer: 0 },
  { q: 'What is the meaning of "Hostile"?', options: ['Unfriendly or aggressive', 'Welcoming', 'Kind', 'Calm'], answer: 0 },
  { q: '"Impartial" means?', options: ['Fair and unbiased', 'Biased', 'Angry', 'Excited'], answer: 0 },
  { q: 'What does "Lethargic" mean?', options: ['Sluggish and lacking energy', 'Energetic', 'Happy', 'Fast'], answer: 0 },
  { q: '"Nostalgic" means?', options: ['Longing for the past', 'Fearful of future', 'Angry', 'Hungry'], answer: 0 },
  { q: 'Opposite of "Transparent" is?', options: ['Opaque', 'Clear', 'Bright', 'Open'], answer: 0 },
  { q: 'What is the meaning of "Redundant"?', options: ['No longer needed', 'Essential', 'New', 'Rare'], answer: 0 },
  { q: '"Skeptical" means?', options: ['Doubting or questioning', 'Trusting fully', 'Happy', 'Sleepy'], answer: 0 },
  { q: 'What does "Trivial" mean?', options: ['Of little importance', 'Very important', 'Difficult', 'Rare'], answer: 0 },
  { q: '"Vivid" means?', options: ['Bright and clear', 'Dull', 'Dark', 'Quiet'], answer: 0 },
];

const GRAMMAR_QUIZ: QuizQuestion[] = [
  { q: 'Choose the correct sentence:', options: ['She don\'t like it', 'She doesn\'t likes it', 'She doesn\'t like it', 'She not like it'], answer: 2 },
  { q: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], answer: 1 },
  { q: 'They ___ playing football now.', options: ['is', 'are', 'was', 'be'], answer: 1 },
  { q: 'I ___ a book yesterday.', options: ['read', 'reads', 'reading', 'readed'], answer: 0 },
  { q: 'The cat ___ on the mat.', options: ['sit', 'sits', 'sitting', 'sat'], answer: 1 },
  { q: 'He ___ here since 2015.', options: ['lives', 'has lived', 'is living', 'lived'], answer: 1 },
  { q: 'If I ___ rich, I would travel.', options: ['am', 'was', 'were', 'be'], answer: 2 },
  { q: 'She is the ___ student in class.', options: ['good', 'better', 'best', 'well'], answer: 2 },
  { q: 'Neither of the boys ___ here.', options: ['are', 'is', 'were', 'be'], answer: 1 },
  { q: 'He drives very ___.', options: ['careful', 'carefully', 'care', 'caring'], answer: 1 },
  { q: 'There are ___ apples in the basket.', options: ['few', 'little', 'much', 'less'], answer: 0 },
  { q: 'I look forward to ___ you.', options: ['see', 'seeing', 'saw', 'seen'], answer: 1 },
  { q: 'The news ___ surprising.', options: ['are', 'is', 'were', 'be'], answer: 1 },
  { q: 'By next year, I ___ graduated.', options: ['will', 'will have', 'would', 'have'], answer: 1 },
  { q: 'You had better ___ a doctor.', options: ['to see', 'see', 'seeing', 'saw'], answer: 1 },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  ...VOCAB_QUIZ,
  ...GRAMMAR_QUIZ,
].slice(0, QUIZ_LEVEL_COUNT);

export const WORD_SCRAMBLES: WordScramble[] = [
  { word: 'ENGLISH', hint: 'A world language' },
  { word: 'GRAMMAR', hint: 'Rules of a language' },
  { word: 'FLUENT', hint: 'Able to speak smoothly' },
  { word: 'VOCABULARY', hint: 'Collection of words' },
  { word: 'SENTENCE', hint: 'A group of words with meaning' },
  { word: 'PRONOUN', hint: 'Replaces a noun (he, she, it)' },
  { word: 'ADJECTIVE', hint: 'Describes a noun' },
  { word: 'ADVERB', hint: 'Describes a verb' },
  { word: 'PREPOSITION', hint: 'Shows position (in, on, at)' },
  { word: 'CONJUNCTION', hint: 'Joins words or clauses' },
  { word: 'ARTICLE', hint: 'A, an, or the' },
  { word: 'TENSE', hint: 'Past, present, or future form' },
  { word: 'PLURAL', hint: 'More than one' },
  { word: 'SINGULAR', hint: 'Only one' },
  { word: 'SYNONYM', hint: 'Word with similar meaning' },
  { word: 'ANTONYM', hint: 'Word with opposite meaning' },
  { word: 'PHRASE', hint: 'Group of words without a verb' },
  { word: 'CLAUSE', hint: 'Group of words with a subject and verb' },
  { word: 'PARAGRAPH', hint: 'Section of writing' },
  { word: 'PUNCTUATION', hint: 'Commas, periods, and more' },
  { word: 'SPELLING', hint: 'Correct letter order in a word' },
  { word: 'PRONUNCIATION', hint: 'How a word sounds' },
  { word: 'LISTENING', hint: 'Understanding spoken English' },
  { word: 'SPEAKING', hint: 'Using your voice in English' },
  { word: 'READING', hint: 'Understanding written text' },
  { word: 'WRITING', hint: 'Putting words on paper' },
  { word: 'DIALOGUE', hint: 'Conversation between people' },
  { word: 'NARRATIVE', hint: 'A story or account' },
  { word: 'ESSAY', hint: 'Short piece of writing' },
  { word: 'SUMMARY', hint: 'Brief overview of main points' },
  { word: 'THESIS', hint: 'Main argument in writing' },
  { word: 'METAPHOR', hint: 'Figure of speech comparing things' },
  { word: 'SIMILE', hint: 'Comparison using like or as' },
  { word: 'IDIOM', hint: 'Expression with special meaning' },
  { word: 'SLANG', hint: 'Informal everyday language' },
  { word: 'FORMAL', hint: 'Polite, official language style' },
  { word: 'INFORMAL', hint: 'Casual, relaxed language style' },
  { word: 'ACCENT', hint: 'Way of pronouncing words' },
  { word: 'DIALECT', hint: 'Regional variety of a language' },
  { word: 'TRANSLATE', hint: 'Change from one language to another' },
  { word: 'INTERPRET', hint: 'Explain the meaning of something' },
  { word: 'COMPREHEND', hint: 'Understand fully' },
  { word: 'MEMORIZE', hint: 'Learn by heart' },
  { word: 'PRACTICE', hint: 'Repeat to improve skill' },
  { word: 'PROGRESS', hint: 'Forward movement in learning' },
  { word: 'ACHIEVE', hint: 'Successfully reach a goal' },
  { word: 'CHALLENGE', hint: 'Something difficult to do' },
  { word: 'CONFIDENCE', hint: 'Belief in your own ability' },
  { word: 'PATIENCE', hint: 'Ability to wait calmly' },
  { word: 'CURIOSITY', hint: 'Desire to learn or know' },
].slice(0, SCRAMBLE_LEVEL_COUNT);

const GRAMMAR_EXTRA_OPTIONS = [
  'was', 'were', 'is', 'are', 'am', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'done', 'doing',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'in', 'on', 'at', 'by', 'with', 'from', 'to', 'of', 'for', 'about', 'into',
  'who', 'whom', 'whose', 'which', 'that', 'what', 'where', 'when',
  'go', 'goes', 'went', 'gone', 'going',
  'see', 'saw', 'seen', 'seeing',
  'make', 'made', 'making',
  'than', 'then', 'while', 'because',
  'their', 'there', "they're",
  'its', "it's",
  'none of these', 'no preposition',
];

/** Ensures every fill-in-the-blank question has exactly 4 shuffled options in play. */
function ensureFourOptions(options: string[], answer: string): string[] {
  if (options.length >= 4) {
    return options.slice(0, 4);
  }
  const used = new Set(options.map((o) => o.toLowerCase().trim()));
  const answerLower = answer.toLowerCase().trim();
  const extra = GRAMMAR_EXTRA_OPTIONS.find(
    (opt) => !used.has(opt.toLowerCase()) && opt.toLowerCase() !== answerLower,
  );
  const fourth = extra ?? 'other';
  const merged = [...options, fourth];
  return merged.length >= 4 ? merged.slice(0, 4) : [...merged, 'none of these'].slice(0, 4);
}

export const FILL_BLANKS: FillBlank[] = FILL_BLANKS_DATA.slice(0, FILL_BLANK_LEVEL_COUNT).map((item) => {
  const options = ensureFourOptions(item.options, item.answer);
  return {
    sentence: item.sentence,
    options,
    answer: options.indexOf(item.answer),
    correctText: item.answer,
    rule: item.rule,
  };
});

export const FLASHCARDS: Flashcard[] = [
  { word: 'Articulate', meaning: 'Able to express thoughts clearly', example: 'She is very articulate in her presentations.' },
  { word: 'Diligent', meaning: 'Hardworking and careful', example: 'He is a diligent student who never misses class.' },
  { word: 'Candid', meaning: 'Honest and straightforward', example: 'Please give me your candid opinion.' },
  { word: 'Resilient', meaning: 'Able to recover quickly from difficulties', example: 'Children are resilient and adapt fast.' },
  { word: 'Scrutinize', meaning: 'Examine closely and critically', example: 'She scrutinized every detail of the contract.' },
  { word: 'Eloquent', meaning: 'Fluent and persuasive in speaking', example: 'The speaker gave an eloquent speech.' },
  { word: 'Persevere', meaning: 'Continue despite difficulty', example: 'She persevered through many challenges.' },
  { word: 'Benevolent', meaning: 'Kind and generous', example: 'The benevolent donor helped many schools.' },
  { word: 'Ambiguous', meaning: 'Open to more than one interpretation', example: 'His answer was ambiguous and confusing.' },
  { word: 'Concise', meaning: 'Brief but comprehensive', example: 'Please keep your report concise.' },
  { word: 'Empathy', meaning: 'Understanding others\' feelings', example: 'A good teacher shows empathy to students.' },
  { word: 'Meticulous', meaning: 'Showing great attention to detail', example: 'She is meticulous about grammar.' },
  { word: 'Innovative', meaning: 'Featuring new methods or ideas', example: 'The app uses innovative teaching methods.' },
  { word: 'Pragmatic', meaning: 'Dealing with things practically', example: 'We need a pragmatic solution.' },
  { word: 'Tenacious', meaning: 'Persistent and determined', example: 'He was tenacious in learning English.' },
  { word: 'Versatile', meaning: 'Able to adapt to many functions', example: 'She is a versatile communicator.' },
  { word: 'Coherent', meaning: 'Logical and consistent', example: 'Write a coherent paragraph.' },
  { word: 'Indifferent', meaning: 'Having no particular interest', example: 'He seemed indifferent to the result.' },
  { word: 'Profound', meaning: 'Very great or intense', example: 'The book had a profound impact on her.' },
  { word: 'Obsolete', meaning: 'No longer produced or used', example: 'That word is nearly obsolete today.' },
  { word: 'Authentic', meaning: 'Genuine and real', example: 'Use authentic materials when learning.' },
  { word: 'Frugal', meaning: 'Sparing with money or resources', example: 'He leads a frugal lifestyle.' },
  { word: 'Hostile', meaning: 'Unfriendly and antagonistic', example: 'The debate became hostile quickly.' },
  { word: 'Impartial', meaning: 'Treating all rivals equally', example: 'The judge must remain impartial.' },
  { word: 'Lethargic', meaning: 'Sluggish and lacking energy', example: 'I felt lethargic after lunch.' },
  { word: 'Nostalgic', meaning: 'Longing for the past', example: 'The song made her feel nostalgic.' },
  { word: 'Redundant', meaning: 'No longer needed or useful', example: 'Remove redundant words from your essay.' },
  { word: 'Skeptical', meaning: 'Not easily convinced', example: 'She was skeptical about the claim.' },
  { word: 'Trivial', meaning: 'Of little value or importance', example: 'Do not waste time on trivial matters.' },
  { word: 'Vivid', meaning: 'Producing powerful images in the mind', example: 'He gave a vivid description of the scene.' },
  { word: 'Abundant', meaning: 'Existing in large quantities', example: 'There are abundant resources online.' },
  { word: 'Cautious', meaning: 'Careful to avoid potential problems', example: 'Be cautious when using new phrases.' },
  { word: 'Deficient', meaning: 'Lacking some essential quality', example: 'His vocabulary was deficient at first.' },
  { word: 'Exquisite', meaning: 'Extremely beautiful or delicate', example: 'She has exquisite taste in literature.' },
  { word: 'Formidable', meaning: 'Inspiring fear or respect', example: 'The exam was a formidable challenge.' },
  { word: 'Gregarious', meaning: 'Fond of company; sociable', example: 'He is gregarious at language meetups.' },
  { word: 'Humble', meaning: 'Having a modest view of oneself', example: 'Stay humble as you improve.' },
  { word: 'Inevitable', meaning: 'Certain to happen', example: 'Mistakes are inevitable when learning.' },
  { word: 'Jubilant', meaning: 'Feeling great happiness', example: 'The class was jubilant after passing.' },
  { word: 'Keen', meaning: 'Having a strong interest', example: 'She is keen to improve her accent.' },
  { word: 'Lucid', meaning: 'Expressed clearly; easy to understand', example: 'His explanation was lucid and helpful.' },
  { word: 'Mundane', meaning: 'Lacking interest or excitement', example: 'Daily drills can feel mundane.' },
  { word: 'Notorious', meaning: 'Famous for something bad', example: 'The word is notorious for tricky spelling.' },
  { word: 'Oblivious', meaning: 'Unaware of what is happening', example: 'He was oblivious to the grammar rule.' },
  { word: 'Plausible', meaning: 'Seeming reasonable or probable', example: 'That is a plausible explanation.' },
  { word: 'Quaint', meaning: 'Attractively old-fashioned', example: 'The village had a quaint charm.' },
  { word: 'Robust', meaning: 'Strong and healthy', example: 'Build a robust vocabulary over time.' },
  { word: 'Subtle', meaning: 'So delicate as to be difficult to notice', example: 'There is a subtle difference in meaning.' },
  { word: 'Tranquil', meaning: 'Free from disturbance; calm', example: 'Study in a tranquil environment.' },
  { word: 'Ubiquitous', meaning: 'Present everywhere', example: 'English is ubiquitous in business.' },
  { word: 'Volatile', meaning: 'Liable to change rapidly', example: 'Markets can be volatile and unpredictable.' },
].slice(0, FLASHCARD_LEVEL_COUNT);
