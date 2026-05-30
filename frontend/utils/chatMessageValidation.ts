export type ChatMessageRejectReason = 'profanity' | 'non_english' | 'hinglish';

export type ChatMessageValidationResult =
  | { valid: true }
  | { valid: false; reason: ChatMessageRejectReason; message: string };

/** Devanagari, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Gurmukhi, Arabic, Cyrillic, CJK, etc. */
const NON_ENGLISH_SCRIPT =
  /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

const REJECT_MESSAGES: Record<ChatMessageRejectReason, string> = {
  profanity: 'Inappropriate language is not allowed. Please keep the chat respectful.',
  non_english: 'Only English is allowed in this chat.',
  hinglish: 'Please write in English only. Hindi and Hinglish are not allowed.',
};

/** Romanized Hindi / Hinglish — exact token match. */
const HINGLISH_WORDS = new Set([
  'aaj', 'ab', 'abhi', 'acha', 'achha', 'accha', 'aadmi', 'ap', 'apka', 'apki', 'apko', 'apna', 'apni', 'apne',
  'arey', 'arre', 'aur', 'aurat', 'aap', 'baat', 'batao', 'btao', 'bahut', 'bhai', 'bhaiya', 'bht', 'bhut',
  'bohot', 'bol', 'bolo', 'bolna', 'bilkul', 'chal', 'chalo', 'dekh', 'dekho', 'dhanyawad', 'dost', 'gaya',
  'gayi', 'gye', 'ghar', 'haan', 'han', 'hai', 'hain', 'ho', 'hun', 'hu', 'hoon', 'hoga', 'hogi', 'honge',
  'hogya', 'hogayi', 'hua', 'hui', 'hue', 'idhar', 'jii', 'jyada', 'kab', 'kb', 'kaafi', 'kaise', 'kaun',
  'kar', 'karo', 'karna', 'karenge', 'karega', 'karegi', 'karte', 'karti', 'karta', 'kiya', 'kisi', 'kis',
  'kisko', 'kitna', 'kitni', 'kitne', 'kr', 'kro', 'krna', 'krlo', 'krdo', 'krte', 'krta', 'krti', 'krdiya',
  'kuch', 'kuchh', 'kya', 'keya', 'kyaa', 'kyun', 'kyu', 'kyon', 'ladka', 'ladki', 'lagta', 'lagti', 'lgta',
  'main', 'mai', 'mein', 'mat', 'mt', 'matlab', 'mtlb', 'mera', 'meri', 'mere', 'mujhe', 'mujhse', 'mujh',
  'nahi', 'nah', 'namaste', 'namaskar', 'nhi', 'nh', 'oye', 'paani', 'pani', 'parso', 'pata', 'pta',
  'raat', 'raha', 'rahi', 'rahe', 'raho', 'rha', 'rhi', 'rhe', 'sab', 'sabhi', 'samajh', 'samjha', 'samjhi',
  'samjhe', 'smjh', 'smjha', 'smjhi', 'shukriya', 'subah', 'sun', 'sunna', 'suno', 'tera', 'teri', 'theek',
  'thik', 'tha', 'thi', 'thoda', 'tujhe', 'tujh', 'tum', 'tumhe', 'tumhara', 'tumhari', 'tu', 'udhar',
  'unka', 'unki', 'unke', 'uska', 'uski', 'usko', 'isko', 'uss', 'vo', 'voh', 'woh', 'waha', 'yaha', 'yahan',
  'ya', 'yaar', 'yar', 'yr', 'yrr', 'ye', 'yeh', 'zyada', 'zyaada',
]);

/** Hindi abuses written in English/Roman letters. */
const HINDI_ABUSE_WORDS = new Set([
  'bakchod', 'bakchodi', 'bahenchod', 'bc', 'behenchod', 'behenkelode', 'benchod', 'bencho',
  'bhenchod', 'bhencho', 'bhsdk', 'bhosad', 'bhosadike', 'bhosda', 'bhosdi', 'bhosadika',
  'bhosdike', 'bsdk', 'chakke', 'chut', 'chutia', 'chutiya', 'chutiye', 'chutmarani',
  'chutmarika', 'chutya', 'gaand', 'gaandfat', 'gaandu', 'gand', 'gandfat', 'gandmara',
  'gandmarani', 'gandu', 'harami', 'haramkhor', 'haramzada', 'haramzade', 'hijda', 'hijde',
  'hijra', 'jhaant', 'jhaat', 'kamina', 'kameena', 'kutiya', 'kutta', 'kutte', 'kutti',
  'lauda', 'lavda', 'lawda', 'loda', 'lode', 'lodi', 'lodu', 'lund', 'lundur', 'lundura',
  'maadarchod', 'maachod', 'madarchd', 'madarchoad', 'madarchod', 'madarchodd', 'madarchohd',
  'madarchood', 'madarcod', 'maderchod', 'madharchod', 'madherchod', 'madhrcohd',
  'madrcohd', 'makichod', 'mc', 'mkc', 'randi', 'randwa', 'raandi', 'saala', 'saale', 'saali',
  'sala', 'suar', 'tatti', 'tatte', 'bewakoof', 'bewakuf', 'pagal', 'pagl',
]);

/** Common Hinglish phrases — Hindi written in English letters. */
const HINGLISH_PATTERNS = [
  /\b(kya|keya|kyaa)\s+(\w+\s+){0,4}(kr|kar|karo|karna|kiya|krta|krti|krte|rhi|rha|rhe|rahi|raha|rahe)\b/i,
  /\b(kya|keya|kyaa)\s+(kr|kar)\s+(rhi|rha|rhe|rahi|raha|rahe)\s+(ho|hai|hu|hun|h)\b/i,
  /\b(kr|kar)\s+(rhi|rha|rhe|rahi|raha|rahe|raho)\s+(ho|hai|hu|hun|h|he)\b/i,
  /\b(kr|kar)\s+(rhi|rha|rhe|rahi|raha|rahe|raho)\b/i,
  /\b(kr|kar)\s+(do|lo|de|dena|lena|dia|di|liya|liye|diya|diye)\b/i,
  /\b(rhi|rha|rhe|rahi|raha|rahe)\s+(ho|hai|hun|hu|h|he|thi|tha)\b/i,
  /\bkaise\s+(ho|hai|h|aap|tum|tu|aapka|tumhara)\b/i,
  /\b(kya|keya)\s+(hal|haal|hai|ho|h|kr|kar|krri|karri)\b/i,
  /\b(pata|pta)\s+(hai|h|nahi|nhi|nh|n)\b/i,
  /\b(theek|thik)\s+(hai|h|hain|h)\b/i,
  /\b(nahi|nhi|nh)\s+(hai|h|aata|ata|aati|aaye|mil|milta|mili)\b/i,
  /\b(chal|chalo)\s+(rha|rhi|rhe|raha|rahi|rahe)\b/i,
  /\bmat\s+(kr|kar|karo|karna|bol|btao|batao|dekh|suno)\b/i,
  /\b(hai|hain|ho|hun)\s+(na|n|kya|keya)\b/i,
  /\b(kaha|kahan|kahin)\s+(ho|hai|se|gaye|gayi|ja|jao)\b/i,
  /\b(kya|keya)\s+(kr|kar)\b/i,
  /\b(kr|kar)\s+(raha|rahi|rahe|rha|rhi|rhe)\b/i,
  /\b(aap|tum|tu)\s+(kaise|kya|keya|kahan|kaha|kab|kyun|kyu)\b/i,
  /\b(bohot|bahut|bht|bhut)\s+(accha|acha|achha|bura|sundar|pyara|pyari)\b/i,
  /\b(kya|keya)\s+(haal|hal)\b/i,
  /\b(kr|kar)\s+(rahi|raha|rahe)\s+(ho|hai|hu|hun)\b/i,
];

const BLOCKED_TOKENS = new Set([
  'ass', 'arse', 'bc', 'bsdk', 'cum', 'fag', 'mc', 'mkc', 'sex', 'tit', 'xxx',
  'chut', 'gand', 'lod', 'lund',
]);

const BLOCKED_WORDS = new Set([
  'anal', 'asshole', 'bastard', 'bitch', 'bitches', 'blowjob', 'boob', 'boobs', 'bullshit',
  'bhenchod', 'bhosda', 'bhosdi', 'bsdk', 'chutiya', 'chutiye', 'cock', 'crap',
  'cunt', 'dick', 'dildo', 'fuck', 'fucked', 'fucker', 'fucking', 'fuckoff', 'fuckyou',
  'gaand', 'handjob', 'hentai', 'horny', 'jerkoff', 'madarchod', 'milf',
  'motherfucker', 'naked', 'nigga', 'nigger', 'nude', 'nudes', 'orgasm', 'penis', 'porn',
  'porno', 'pussy', 'rape', 'rapist', 'randi', 'retard', 'retarded', 'sexy', 'shit', 'slut',
  'whore', 'wank', 'wanker',
  ...HINDI_ABUSE_WORDS,
]);

const PROFANITY_PATTERNS = [
  /\bf+u+c+k+/i,
  /\bs+h+i+t+/i,
  /\bb+i+t+c+h+/i,
  /\ba+s+s+h+o+l+e+/i,
  /\bb+a+s+t+a+r+d+/i,
  /\bd+i+c+k+/i,
  /\bc+o+c+k+/i,
  /\bp+u+s+s+y+/i,
  /\bc+u+n+t+/i,
  /\bw+h+o+r+e+/i,
  /\bs+l+u+t+/i,
  /\bn+i+g+g+/i,
  /\bn+i+g+a+/i,
  /\bf+a+g+g+/i,
  /\bf+a+g+/i,
  /\bm+a+d+a+r+c+h+o+d+/i,
  /\bb+h+e+n+c+h+o+d+/i,
  /\bc+h+u+t+i+y+a+/i,
  /\bc+h+u+t+/i,
  /\bg+a+a+n+d+/i,
  /\bl+u+n+d+/i,
  /\br+a+n+d+i+/i,
  /\bb+h+o+s+d+/i,
  /\bm+a+d+a+r+c+h+o+d+/i,
  /\bb+h+e+n+c+h+o+d+/i,
  /\b(?:l+o+d+a|l+u+n+d|l+a+u+d+a|l+a+v+d+a|l+o+d+e)\b/i,
  /\bg+a+n+d+u+/i,
  /\bc+h+o+d+/i,
  /\bs+e+x+/i,
  /\bp+o+r+n+/i,
  /\bn+u+d+e+/i,
  /\br+a+p+e+/i,
  /\bb+o+o+b+/i,
  /\bc+u+m+/i,
  /\bx+x+x+/i,
];

function normalizeForProfanity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@$4]/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z0-9\u0900-\u097F]/g, '');
}

function normalizeForHinglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function splitCompactTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function containsProfanity(text: string): boolean {
  const rawTokens = [...tokenizeWords(text), ...splitCompactTokens(text)];
  const normalizedFull = normalizeForProfanity(text);

  for (const token of rawTokens) {
    const normalizedToken = normalizeForProfanity(token);
    if (BLOCKED_TOKENS.has(token) || BLOCKED_TOKENS.has(normalizedToken)) {
      return true;
    }
    if (BLOCKED_WORDS.has(token) || BLOCKED_WORDS.has(normalizedToken)) {
      return true;
    }
  }

  for (const word of BLOCKED_WORDS) {
    if (word.length >= 4 && normalizedFull.includes(word)) {
      return true;
    }
  }

  for (const token of BLOCKED_TOKENS) {
    if (normalizedFull === token) {
      return true;
    }
  }

  return PROFANITY_PATTERNS.some((pattern) => pattern.test(normalizedFull));
}

function containsNonEnglishScript(text: string): boolean {
  return NON_ENGLISH_SCRIPT.test(text);
}

function containsHinglish(text: string): boolean {
  const tokens = [...tokenizeWords(text), ...splitCompactTokens(text)];
  if (tokens.some((token) => HINGLISH_WORDS.has(token))) {
    return true;
  }

  const normalized = normalizeForHinglish(text);
  return HINGLISH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasEnglishLetters(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

export function validateChatMessage(rawText: string): ChatMessageValidationResult {
  const text = rawText.trim();
  if (!text) {
    return { valid: false, reason: 'non_english', message: REJECT_MESSAGES.non_english };
  }

  if (containsProfanity(text)) {
    return { valid: false, reason: 'profanity', message: REJECT_MESSAGES.profanity };
  }

  if (containsNonEnglishScript(text)) {
    return { valid: false, reason: 'non_english', message: REJECT_MESSAGES.non_english };
  }

  if (containsHinglish(text)) {
    return { valid: false, reason: 'hinglish', message: REJECT_MESSAGES.hinglish };
  }

  if (!hasEnglishLetters(text)) {
    return { valid: false, reason: 'non_english', message: REJECT_MESSAGES.non_english };
  }

  return { valid: true };
}

export function isChatMessageBlocked(text: string): boolean {
  return !validateChatMessage(text).valid;
}
