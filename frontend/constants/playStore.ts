import { APP_INFO } from '@/constants/appInfo';
import { RENDER_API_URL } from '@/constants/api';

/** GitHub Pages — stable HTTPS legal URLs for Google Play Console. */
export const GITHUB_PAGES_BASE = 'https://gone123456006-spec.github.io/aarambh';

/** Public HTTPS URLs for Google Play Console listing (must stay reachable). */
export const PLAY_STORE_URLS = {
  privacyPolicy: `${GITHUB_PAGES_BASE}/privacy-policy.html`,
  termsAndConditions: `${GITHUB_PAGES_BASE}/terms-and-conditions.html`,
  /** Same pages on Render after backend redeploy */
  privacyPolicyRender: `${RENDER_API_URL}/privacy-policy`,
  termsRender: `${RENDER_API_URL}/terms-and-conditions`,
  supportEmail: APP_INFO.email,
} as const;

/** Permission strings shown on iOS/Android — required for Google Play (camera, mic). */
export const PLAY_STORE_PERMISSIONS = {
  camera:
    `${APP_INFO.appName} uses your camera only when you start video English practice. We do not record or upload video without your action.`,
  microphone:
    `${APP_INFO.appName} uses your microphone for voice and video lessons. Audio is used only for learning features you choose to use.`,
  notifications:
    `${APP_INFO.appName} may send learning reminders and account updates. You can turn off notifications in device settings.`,
};

/** Short store listing copy — paste into Play Console if helpful. */
export const PLAY_STORE_LISTING = {
  appName: APP_INFO.appName,
  shortDescription:
    'Learn English with courses, games, daily words, rewards, and live practice chat.',
  fullDescription: `${APP_INFO.appName} helps you practice English with structured courses, interactive games, daily vocabulary rewards, leaderboards, and random chat with other learners. Sign in with Gmail OTP, track your progress, and use camera or microphone only when you start video practice.`,
  category: 'Education',
  contactEmail: APP_INFO.email,
  contactPhone: `+91 ${APP_INFO.mobile}`,
  privacyPolicyUrl: PLAY_STORE_URLS.privacyPolicy,
  termsUrl: PLAY_STORE_URLS.termsAndConditions,
};
