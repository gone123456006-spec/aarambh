import { APP_INFO } from '@/constants/appInfo';
import { PLAY_STORE_URLS } from '@/constants/playStore';

export type PrivacySection = { title: string; body: string };

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. Overview',
    body: `This Privacy Policy explains how ${APP_INFO.appName} ("we", "our", "us") handles information when you use our English learning app on Google Play and other official channels. Developer contact: ${APP_INFO.email}. By using the App, you agree to this policy.`,
  },
  {
    title: '2. Information we collect',
    body: `We collect only what is needed to run the App: email address and one-time login codes (OTP); profile details you provide (name, phone number, region, gender, learning level); learning progress, game scores, and daily word rewards; messages you send in random chat; and basic server logs needed for security and reliability. We do not sell your personal information.`,
  },
  {
    title: '3. Information we do not collect',
    body: `${APP_INFO.appName} does not collect or require access to: your contact list, precise or approximate location, SMS, call logs, advertising ID, or health or financial data. We do not use contacts or location permissions on Android or iOS. Optional profile photos use your device’s system photo picker — we only receive the single image you choose, not your full gallery.`,
  },
  {
    title: '4. Camera and microphone',
    body: `If you use video or voice practice, ${APP_INFO.appName} requests camera and/or microphone permission only when you tap to start that feature. Live audio and video are sent directly between matched learners (peer-to-peer) for practice and are not recorded or stored on our servers. We do not access camera or microphone in the background. Profile pictures are optional and chosen via the system photo picker (gallery only — we never open the camera for profile photos). Do not share inappropriate content. User content must follow Google Play policies and our Terms & Conditions.`,
  },
  {
    title: '5. Random chat and user content',
    body: `Random chat lets matched learners exchange text messages for English practice. Optional voice or video practice is available only when both users agree to start a call. Messages are visible to your chat partner during an active session. We use automated filters for abusive or non-English content. You can skip a partner or report a user from chat (flag icon) or Contact Us. Random chat is for learning, not dating or matchmaking.`,
  },
  {
    title: '6. How we use information',
    body: `We use data to authenticate your account, deliver courses and games, match chat partners, show leaderboards, send OTP emails, improve the App, respond to support requests, and enforce our Terms. We do not use your data for third-party advertising.`,
  },
  {
    title: '7. Sharing and processors',
    body: `We share data only with service providers needed to operate the App (for example cloud hosting and email delivery for OTP), when required by law, or to protect user safety. We do not sell personal data. Processors are bound to use data only to provide services to us.`,
  },
  {
    title: '8. Security',
    body: `We use reasonable technical and organisational measures to protect your data, including encryption in transit (HTTPS for API requests and secure connections for live chat). No method of transmission or storage is 100% secure.`,
  },
  {
    title: '9. Retention',
    body: `We retain information while your account is active and as needed for legal, security, or operational purposes. When you delete your account, we remove your profile, progress, and associated server data as described below.`,
  },
  {
    title: '10. Children',
    body: `The App is not directed at children under 13. Users under 18 should use the App with a parent or guardian's consent. Contact us if you believe a child under 13 has provided personal data.`,
  },
  {
    title: '11. Your choices and account deletion',
    body: `You can update profile details in the App, revoke camera/microphone permissions in device settings, skip or report chat partners, and delete your account from Contact Us in the menu (Delete my account). Deletion removes your profile, progress, chat-related data, and rewards from our servers. You may also email ${APP_INFO.email} from your registered Gmail to request deletion. Public policy URL: ${PLAY_STORE_URLS.privacyPolicy}`,
  },
  {
    title: '12. Google Play and Data safety',
    body: `When you install from Google Play, Google may collect data under its own policies. Our Google Play Data safety form describes what we collect and matches this Privacy Policy. In-app permissions match the features you use.`,
  },
  {
    title: '13. Changes',
    body: `We may update this Privacy Policy from time to time. The "Last updated" date at the top will change when we do. Continued use after changes means you accept the updated policy.`,
  },
  {
    title: '14. Contact',
    body: `Privacy questions: ${APP_INFO.email} | Phone: +91 ${APP_INFO.mobile} | WhatsApp: +91 ${APP_INFO.whatsapp}`,
  },
];

export const PRIVACY_LAST_UPDATED = '3 June 2026';
