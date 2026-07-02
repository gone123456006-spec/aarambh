import { APP_INFO } from '@/constants/appInfo';
import { PLAY_STORE_URLS } from '@/constants/playStore';

export type TermsSection = {
  title: string;
  body: string;
};

/** Terms aligned with Google Play Developer Program policies. */
export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Acceptance of Terms',
    body: `By downloading, installing, or using ${APP_INFO.appName} ("the App"), you agree to these Terms & Conditions ("Terms"). If you do not agree, do not use the App. These Terms are between you and ${APP_INFO.companyName}. Your use is also subject to Google Play Terms of Service and Google Play Developer Program Policies when you obtain the App from Google Play.`,
  },
  {
    title: '2. Eligibility',
    body: `You must be at least 13 years of age to use the App. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms. You must provide accurate registration information and keep your account secure.`,
  },
  {
    title: '3. Description of Service',
    body: `${APP_INFO.appName} provides English learning features including courses, games, daily vocabulary rewards, leaderboards, random text chat with other learners for practice, optional voice or video practice when both users agree to start a call, and in-app support (Ohm Assist). The App is for education and personal learning, not dating or matchmaking. We may add, modify, or remove features at any time.`,
  },
  {
    title: '4. Account and Authentication',
    body: `Access requires a valid Gmail address and one-time password (OTP) verification. You are responsible for all activity under your account. Notify us at ${APP_INFO.email} if you suspect unauthorised access. We may suspend or terminate accounts that violate these Terms.`,
  },
  {
    title: '5. User Conduct',
    body: `You agree not to: harass, threaten, or abuse others; post illegal, hateful, sexually explicit, or violent content; share personal contact details, money requests, or spam; impersonate others; hack or scrape the App; or use random chat for anything other than good-faith English practice. We may remove access based on reports or policy violations.`,
  },
  {
    title: '6. User-Generated Content (UGC)',
    body: `Chat messages and other content you submit are your responsibility. You grant us a limited licence to host and process such content only to operate the App. We do not endorse user content. We use automated filters and may remove content or suspend accounts that violate these Terms or Google Play User Generated Content policies.`,
  },
  {
    title: '6a. Reporting and moderation',
    body: `In random chat you can skip a partner, use the report (flag) button to email support, or contact us through Contact Us in the menu. Do not share phone numbers, addresses, payment details, or inappropriate material in chat. We review reports and may suspend accounts that harm other learners.`,
  },
  {
    title: '6b. Camera and microphone',
    body: `${APP_INFO.appName} requests camera and microphone access only when you start features that need them (for example video or voice English practice). We do not access camera or microphone in the background. We do not access your photo gallery. You must not share illegal, harmful, or infringing media.`,
  },
  {
    title: '7. Intellectual Property',
    body: `App software, design, logos, course materials, games, and daily word content are owned by us or our licensors. You receive a limited, non-exclusive, non-transferable licence for personal learning. You may not copy, resell, or redistribute our content without permission.`,
  },
  {
    title: '8. Points, Rewards, and Leaderboard',
    body: `Points, daily rewards, and leaderboard rankings are virtual engagement incentives with no cash value. They are non-transferable and may be adjusted if we detect abuse or errors.`,
  },
  {
    title: '9. Purchases and Google Play Billing',
    body: `If paid products are offered in future, purchases through Google Play are processed by Google under its billing terms. Refunds follow Google Play policies unless required otherwise by law.`,
  },
  {
    title: '10. Privacy',
    body: `We handle email, profile, progress, and chat data as described in our Privacy Policy (menu → Privacy Policy or ${PLAY_STORE_URLS.privacyPolicy}). Do not share sensitive personal data in random chat.`,
  },
  {
    title: '11. Permissions',
    body: `The App uses Internet (courses, chat, login), Camera, and Microphone (only when you start related features). We do not request contacts, location, SMS, or gallery access. You can revoke permissions in device Settings; some features may not work without them.`,
  },
  {
    title: '12. Account deletion',
    body: `You may delete your account from Contact Us → Delete my account, or email ${APP_INFO.email} from your registered Gmail. Deletion permanently removes your profile, progress, and associated server data.`,
  },
  {
    title: '13. Disclaimer of Warranties',
    body: `THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE UNINTERRUPTED SERVICE OR SPECIFIC LEARNING OUTCOMES.`,
  },
  {
    title: '14. Limitation of Liability',
    body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE APP. OUR TOTAL LIABILITY SHALL NOT EXCEED ₹100 OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE A CLAIM, WHICHEVER IS GREATER WHERE PERMITTED BY LAW.`,
  },
  {
    title: '15. Termination',
    body: `You may stop using the App at any time. We may suspend or terminate access if you breach these Terms or for legal or security reasons.`,
  },
  {
    title: '16. Changes to Terms',
    body: `We may update these Terms. Material changes appear in the App with an updated date. Continued use means acceptance.`,
  },
  {
    title: '17. Governing Law',
    body: `These Terms are governed by the laws of India, subject to mandatory consumer protections in your country of residence.`,
  },
  {
    title: '18. Contact',
    body: `Questions: ${APP_INFO.email} | Phone: +91 ${APP_INFO.mobile} | WhatsApp: +91 ${APP_INFO.whatsapp}`,
  },
  {
    title: '19. Google Play',
    body: `When distributed via Google Play, you must comply with Google Play Developer Program Policies. Google is not responsible for the App or these Terms.`,
  },
];

export const TERMS_LAST_UPDATED = '3 June 2026';
