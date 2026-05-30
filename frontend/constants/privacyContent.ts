import { APP_INFO } from '@/constants/appInfo';

export type PrivacySection = { title: string; body: string };

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. Overview',
    body: `This Privacy Policy explains how ${APP_INFO.appName} ("we", "our", "us") handles information when you use our English learning app distributed on Google Play and other official channels. By using the App, you agree to this policy.`,
  },
  {
    title: '2. Information we collect',
    body: `We may collect: email address and one-time login codes; profile details you provide (name, region, gender, learning level); learning progress, game scores, and daily word rewards; messages you send in random chat (to operate the service); and basic device or app usage data needed for security and performance.`,
  },
  {
    title: '3. Photos, camera, and video',
    body: `If you use camera or video features, ${APP_INFO.appName} requests permission through your device settings. We use the camera and microphone only for English practice features you start. We do not access your camera, microphone, or photo library in the background. Do not share inappropriate images or videos. Content must follow Google Play User Generated Content policies and our Terms & Conditions.`,
  },
  {
    title: '4. How we use information',
    body: `We use data to authenticate your account, deliver courses and games, match chat partners, show leaderboards, send OTP emails, improve the App, and respond to support requests. We do not sell your personal information.`,
  },
  {
    title: '5. Sharing',
    body: `We share data only with service providers needed to run the App (e.g. email for OTP, hosting), when required by law, or to protect safety. Random chat messages are visible to matched learners only during an active session.`,
  },
  {
    title: '6. Children',
    body: `The App is not directed at children under 13. If you are under 18, use the App with a parent or guardian's consent. Contact us if you believe a child has provided personal data without permission.`,
  },
  {
    title: '7. Security and retention',
    body: `We use reasonable measures to protect your data. No method is 100% secure. We retain information while your account is active and as needed for legal or operational purposes.`,
  },
  {
    title: '8. Your choices and account deletion',
    body: `You can update profile details in the App, deny camera/microphone permissions in device settings, and delete your account from Contact Us in the menu. Deletion removes your profile, progress, chat history, and associated server data. You may also email ${APP_INFO.email} from your registered address to request deletion.`,
  },
  {
    title: '9. Google Play',
    body: `When you install from Google Play, Google may collect data under its own policies. Our Google Play Data safety section describes what we collect. In-app permissions always match the features you use.`,
  },
  {
    title: '10. Contact',
    body: `Privacy questions: ${APP_INFO.email} | Phone: +91 ${APP_INFO.mobile}`,
  },
];

export const PRIVACY_LAST_UPDATED = '28 May 2026';
