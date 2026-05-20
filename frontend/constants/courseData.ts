import { MaterialCommunityIcons } from '@expo/vector-icons';

export type Lesson = {
  id: string;
  title: string;
  duration: string;
  type: string;
  description: string;
  pdfTitle: string;
};

export const LECTURE_VIDEO = require('../assets/videos/Lacture 1 .mp4');

export type LevelId = 'beginner' | 'intermediate' | 'advanced';

export const COURSE_DATA: {
  id: LevelId;
  title: string;
  subtitle: string;
  color: [string, string];
  videoSource: typeof LECTURE_VIDEO;
  lessons: Lesson[];
}[] = [
  {
    id: 'beginner',
    title: 'Beginner',
    subtitle: 'Foundation & Basics',
    color: ['#00b894', '#55efc4'],
    videoSource: LECTURE_VIDEO,
    lessons: [
      {
        id: 'b1',
        title: 'Introduction to English',
        duration: '8:45',
        type: 'video',
        description:
          'This lesson introduces the English alphabet, core sounds, and everyday greetings for your first conversations. You will practice introducing yourself, asking simple questions, and responding politely when meeting new people at school, work, or in the community. Guided speaking drills build listening confidence, while the PDF recap lists essential phrases, spelling patterns, and short homework tasks to review before the next lesson.',
        pdfTitle: 'Lesson 1 — Introduction Notes',
      },
      {
        id: 'b2',
        title: 'Basic Grammar Rules',
        duration: '12:20',
        type: 'video',
        description:
          'Learn how nouns, verbs, and adjectives work together to form clear English sentences. This lesson explains subject–verb agreement, common word order, and simple present tense with easy examples you can use immediately. You will fix typical beginner mistakes through quick exercises and speaking prompts. Download the PDF for grammar charts, fill-in-the-blank practice, and a checklist to track what you have mastered before advancing.',
        pdfTitle: 'Lesson 2 — Grammar Basics PDF',
      },
      {
        id: 'b3',
        title: 'Common Greetings',
        duration: '10:15',
        type: 'video',
        description:
          'Master polite greetings, farewells, and expressions such as please, thank you, and excuse me for daily interactions. The video models formal and informal phrases for mornings, evenings, and meeting someone for the first time. Repeat-after-me practice helps your pronunciation sound natural and friendly. The worksheet PDF includes dialogue scripts, cultural notes on when to use each greeting, and role-play ideas to try with a friend or study partner.',
        pdfTitle: 'Lesson 3 — Greetings Worksheet',
      },
      {
        id: 'b4',
        title: 'Numbers & Counting',
        duration: '15:30',
        type: 'video',
        description:
          'Count confidently from one to one hundred and use numbers when shopping, telling time, sharing phone digits, or discussing age and prices. This lesson covers cardinal numbers, basic math words, and how to say dates clearly in English. Interactive drills train your ear to recognize spoken numbers quickly. The PDF provides number charts, listening exercises, and real-world scenarios such as ordering food or reading a bus schedule.',
        pdfTitle: 'Lesson 4 — Numbers Practice PDF',
      },
      {
        id: 'b5',
        title: 'Daily Objects',
        duration: '9:50',
        type: 'video',
        description:
          'Expand your vocabulary by naming common objects found at home, in the classroom, and at work. You will learn articles, plural forms, and simple sentences such as “This is a chair” or “Those are my books.” Picture-based practice strengthens memory and helps you describe your surroundings accurately. The companion PDF groups words by room and topic, with labeling activities and a mini quiz to reinforce spelling before you finish the beginner level.',
        pdfTitle: 'Lesson 5 — Daily Objects PDF',
      },
    ],
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    subtitle: 'Grammar & Conversation',
    color: ['#0984e3', '#74b9ff'],
    videoSource: LECTURE_VIDEO,
    lessons: [
      {
        id: 'i1',
        title: 'Sentence Structures',
        duration: '20:10',
        type: 'video',
        description:
          'Build longer, more natural sentences using subjects, verbs, objects, and common connectors. This lesson shows how to combine simple ideas into compound and complex sentences without losing clarity. You will practice writing and speaking with real-life examples about hobbies, plans, and opinions. The PDF includes sentence diagrams, transformation exercises, and prompts that prepare you for everyday conversations and short paragraph writing in English.',
        pdfTitle: 'Lesson 1 — Sentence Structures PDF',
      },
      {
        id: 'i2',
        title: 'Verbs & Tenses',
        duration: '18:45',
        type: 'video',
        description:
          'Understand present, past, and future tenses so you can talk about habits, completed actions, and upcoming plans with confidence. The lesson highlights irregular verbs, time expressions, and questions learners often find difficult. Timed drills help you choose the correct tense automatically while speaking. Use the PDF tense tables, timeline activities, and answer keys to review mistakes and build fluency before moving to travel and opinion topics.',
        pdfTitle: 'Lesson 2 — Verbs & Tenses PDF',
      },
      {
        id: 'i3',
        title: 'Travel Vocabulary',
        duration: '22:30',
        type: 'video',
        description:
          'Prepare for trips abroad with essential words and phrases for airports, hotels, restaurants, and public transport. Learn how to ask for directions, report a problem, and book accommodation politely in English. Role-play segments simulate check-in desks and customs conversations so you feel ready on arrival. The travel PDF packs phrase lists, fill-in dialogues, and a packing checklist of language goals to practice before your next journey.',
        pdfTitle: 'Lesson 3 — Travel English PDF',
      },
      {
        id: 'i4',
        title: 'Expressing Opinions',
        duration: '19:15',
        type: 'video',
        description:
          'Share what you think, agree, and disagree respectfully using phrases such as “In my opinion” and “I see your point.” This lesson teaches softening language, supporting ideas with reasons, and asking follow-up questions during discussions. Debate-style activities build confidence in meetings, classrooms, and casual chats. The PDF offers opinion frames, connector word lists, and topic cards for pair practice so you can argue ideas clearly without sounding rude.',
        pdfTitle: 'Lesson 4 — Opinions & Debate PDF',
      },
      {
        id: 'i5',
        title: 'Listening Practice',
        duration: '25:00',
        type: 'video',
        description:
          'Train your ear with short dialogues, announcements, and stories spoken at a natural pace. You will learn strategies for catching key words, predicting meaning from context, and taking quick notes while listening. Comprehension questions check understanding after each clip. The workbook PDF provides transcripts, gap-fill exercises, and extra audio-style scripts to replay at home until you recognize common phrases without reading subtitles.',
        pdfTitle: 'Lesson 5 — Listening Workbook',
      },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    subtitle: 'Fluency & Mastery',
    color: ['#6c5ce7', '#a29bfe'],
    videoSource: LECTURE_VIDEO,
    lessons: [
      {
        id: 'a1',
        title: 'Business English Basics',
        duration: '30:00',
        type: 'video',
        description:
          'Develop professional English for emails, meetings, introductions, and workplace small talk. This lesson covers polite tone, clear subject lines, and phrases for scheduling calls or following up with colleagues. You will practice opening and closing messages that sound confident yet respectful. The business PDF includes email templates, meeting agendas, vocabulary for office tools, and revision tasks to polish your formal writing before real workplace use.',
        pdfTitle: 'Lesson 1 — Business English PDF',
      },
      {
        id: 'a2',
        title: 'Public Speaking Tips',
        duration: '28:45',
        type: 'video',
        description:
          'Learn to structure speeches with a strong opening, organized main points, and a memorable conclusion. The video demonstrates pacing, eye contact, and voice projection techniques that keep audiences engaged. You will outline a short talk and deliver key lines with reduced filler words. Download the speaker PDF for outline frameworks, gesture reminders, and self-evaluation rubrics to rehearse presentations for class, work, or community events.',
        pdfTitle: 'Lesson 2 — Public Speaking PDF',
      },
      {
        id: 'a3',
        title: 'Idioms & Phrasal Verbs',
        duration: '32:15',
        type: 'video',
        description:
          'Master idioms and phrasal verbs native speakers use in casual and professional conversation. Each expression is explained with context, so you know when it is appropriate and when to avoid it. Matching games and mini-stories help meanings stick beyond memorization. The guide PDF lists high-frequency phrases, example sentences, and practice paragraphs that challenge you to use new idioms correctly in writing and speaking tasks.',
        pdfTitle: 'Lesson 3 — Idioms Guide PDF',
      },
      {
        id: 'a4',
        title: 'Academic Writing',
        duration: '35:20',
        type: 'video',
        description:
          'Write clear academic paragraphs and short essays using introductions, thesis statements, supporting evidence, and conclusions. This lesson explains linking words, formal tone, and how to paraphrase sources without copying. Sample essays show strong and weak versions side by side for comparison. The writing PDF provides outline templates, citation reminders, peer-review questions, and editing checklists to improve structure before submitting school or college assignments.',
        pdfTitle: 'Lesson 4 — Academic Writing PDF',
      },
      {
        id: 'a5',
        title: 'Advanced Pronunciation',
        duration: '25:45',
        type: 'video',
        description:
          'Improve stress, rhythm, intonation, and difficult consonant sounds so listeners understand you on the first try. Slow-motion demonstrations show mouth placement for sounds many learners confuse. Shadowing exercises let you mimic native rhythm in sentences about news, stories, and interviews. The pronunciation PDF maps problem sounds to practice words, includes minimal-pair lists, and suggests daily five-minute drills for lasting improvement.',
        pdfTitle: 'Lesson 5 — Pronunciation PDF',
      },
      {
        id: 'a6',
        title: 'Debating Techniques',
        duration: '29:30',
        type: 'video',
        description:
          'Present arguments, counter-arguments, and rebuttals in structured debates suitable for competitions or classroom discussion. Learn how to research a topic, signpost your points, and respond respectfully when others disagree. Timed rounds build quick thinking under pressure. The debating PDF supplies motion ideas, note-taking layouts, scoring criteria, and phrase banks for agreeing, challenging evidence, and summarizing your final position clearly.',
        pdfTitle: 'Lesson 6 — Debating PDF',
      },
      {
        id: 'a7',
        title: 'Understanding Accents',
        duration: '31:10',
        type: 'video',
        description:
          'Recognize features of British, American, Indian, and other English accents through focused listening tasks. You will learn how vowel shifts, rhythm, and local vocabulary change meaning without blocking comprehension. Clips from different regions train flexible listening for films, podcasts, and international calls. The accents PDF notes key differences, provides transcript snippets, and suggests media resources to continue exposure after the lesson ends.',
        pdfTitle: 'Lesson 7 — Accents PDF',
      },
      {
        id: 'a8',
        title: 'Creative Storytelling',
        duration: '27:50',
        type: 'video',
        description:
          'Tell engaging stories using vivid vocabulary, sensory details, and clear narrative structure from setup to resolution. This lesson explores character, setting, conflict, and dialogue that sounds natural when read aloud. You will draft a short anecdote and revise it for flow and emotion. The storytelling PDF offers plot prompts, editing questions, and a peer feedback form to polish creative pieces for performances or written portfolios.',
        pdfTitle: 'Lesson 8 — Storytelling PDF',
      },
      {
        id: 'a9',
        title: 'Professional Interviews',
        duration: '33:40',
        type: 'video',
        description:
          'Answer interview questions confidently using the STAR method for experience-based responses and polished self-introductions. Practice handling strengths, weaknesses, and salary topics with professional tone. Mock interviews highlight body language and follow-up questions employers often ask. The interview PDF includes question lists, answer frameworks, vocabulary for achievements, and a preparation timeline to review the night before your real appointment.',
        pdfTitle: 'Lesson 9 — Interview Prep PDF',
      },
      {
        id: 'a10',
        title: 'Final Graduation Project',
        duration: '45:00',
        type: 'video',
        description:
          'Combine grammar, vocabulary, speaking, and writing skills in a final graduation presentation that showcases your English journey. You will plan a topic, gather supporting materials, rehearse delivery, and reflect on progress since your first lesson. Mentors explain assessment criteria and how to manage nerves on presentation day. The project PDF outlines milestones, rubric details, reflection prompts, and submission steps to complete your Aarambh course successfully.',
        pdfTitle: 'Lesson 10 — Graduation Project PDF',
      },
    ],
  },
];

export const SAMPLE_PDF_URL =
  'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf';

export const LEVEL_ICONS: Record<
  LevelId,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  beginner: 'sprout',
  intermediate: 'school',
  advanced: 'medal',
};

export const TOTAL_LESSONS = COURSE_DATA.reduce((acc, lvl) => acc + lvl.lessons.length, 0);
