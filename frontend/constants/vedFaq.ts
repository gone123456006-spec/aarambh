export type VedFaqEntry = {
  id: string;
  label: string;
  keywords: string[];
  answer: string;
};

export const ASSISTANT_NAME = "Ohm Assist";

export const VED_WELCOME =
  "Hi! I'm Ohm Assist, your Ohm's support guide. Ask me anything about the app, or tap a topic below.";

export const VED_FALLBACK =
  "I'm not sure about that yet. Try asking about login, random chat, games, courses, profile, or connection issues. You can also email support from your account settings when available.";

export const VED_FAQ: VedFaqEntry[] = [
  {
    id: 'about',
    label: 'What is this app?',
    keywords: ['what is', 'about', 'ohms', "ohm's", 'purpose', 'app'],
    answer:
      "Ohm's helps you practice English through live random chat, learning games, video courses, and structured lessons. Use Home to explore features and the tabs at the bottom to switch between sections.",
  },
  {
    id: 'login',
    label: 'How do I sign in?',
    keywords: ['login', 'sign in', 'signin', 'otp', 'email', 'gmail', 'account', 'register'],
    answer:
      'Tap Get started on the welcome screen, then sign in with your Gmail address. You will receive a one-time OTP code by email — enter it to access the app. Only Gmail addresses are supported right now.',
  },
  {
    id: 'chat',
    label: 'Random chat',
    keywords: ['chat', 'random', 'match', 'partner', 'english chat', 'live chat', 'message'],
    answer:
      'From Home, open "Chat in English" or the "Chat with Random Free" banner to match with another learner. Type messages at the bottom, use Skip to find a new partner, and make sure the backend server is running for real-time chat.',
  },
  {
    id: 'games',
    label: 'Games tab',
    keywords: ['game', 'games', 'practice', 'grammar', 'quiz', 'leaderboard'],
    answer:
      'The Game tab has English practice games like grammar quizzes. Your progress is saved on the device. Open Leaderboard or Performance from Home to track how you are doing.',
  },
  {
    id: 'courses',
    label: 'My Courses',
    keywords: ['course', 'courses', 'lesson', 'video', 'lecture', 'my courses', 'learn'],
    answer:
      'My Courses has video lessons and PDFs organized by level. Complete lessons to unlock the next ones. Progress syncs when you are logged in and connected to the server.',
  },
  {
    id: 'assist',
    label: 'Who is Ohm Assist?',
    keywords: ['ohm assist', 'ohms assist', 'ved', 'bot', 'assistant', 'help', 'support', 'faq'],
    answer:
      "I'm Ohm Assist — your in-app support guide for Ohm's. I answer common questions about the app. For anything I can't help with, contact your teacher or app support.",
  },
  {
    id: 'profile',
    label: 'Profile & logout',
    keywords: ['profile', 'logout', 'log out', 'sign out', 'name', 'edit'],
    answer:
      'Open the menu (☰) on Home to view or edit your profile. To sign out, use Logout in the sidebar — you will return to the welcome screen.',
  },
  {
    id: 'connection',
    label: 'Connection issues',
    keywords: ['connect', 'connection', 'server', 'network', 'error', 'not working', 'backend', 'api'],
    answer:
      'Live chat and login need the backend API running. On your phone, use the same Wi‑Fi as your computer and set EXPO_PUBLIC_API_URL in frontend/.env to your machine\'s LAN IP. Restart Expo after changing .env.',
  },
  {
    id: 'group',
    label: 'Group & calls',
    keywords: ['group', 'discussion', 'call', 'voice', 'video call'],
    answer:
      'Group Discussion and Call in English are shown on Home and are being expanded. Random chat is available now for live text practice with other learners.',
  },
];

export function getVedReply(userText: string): string {
  const normalized = userText.toLowerCase().trim();
  if (!normalized) {
    return 'Please type a question or tap one of the topics below.';
  }

  let best: VedFaqEntry | null = null;
  let bestScore = 0;

  for (const entry of VED_FAQ) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best && bestScore > 0) {
    return best.answer;
  }

  return VED_FALLBACK;
}
