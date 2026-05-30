import { APP_INFO } from '@/constants/appInfo';

export type TermsSection = {
  title: string;
  body: string;
};

/** Terms aligned with common Google Play Developer Program policies. */
export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Acceptance of Terms',
    body: `By downloading, installing, or using ${APP_INFO.appName} ("the App"), you agree to these Terms & Conditions ("Terms"). If you do not agree, do not use the App. These Terms form a binding agreement between you and ${APP_INFO.companyName} ("we", "us", "our"). Your use of the App is also subject to the Google Play Terms of Service and Google Play policies when you obtain the App from Google Play.`,
  },
  {
    title: '2. Eligibility',
    body: `You must be at least 13 years of age to use the App. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms on your behalf. You must provide accurate registration information and keep your account credentials secure.`,
  },
  {
    title: '3. Description of Service',
    body: `${APP_INFO.appName} provides English learning features including courses, games, daily vocabulary rewards, leaderboards, random chat with other learners, and in-app support (Ohm Assist). We may add, modify, or remove features at any time. The App is provided for educational and personal use unless we agree otherwise in writing.`,
  },
  {
    title: '4. Account and Authentication',
    body: `Access may require a valid Gmail address and one-time password (OTP) verification. You are responsible for all activity under your account. Notify us immediately at ${APP_INFO.email} if you suspect unauthorised access. We may suspend or terminate accounts that violate these Terms.`,
  },
  {
    title: '5. User Conduct',
    body: `You agree not to: harass, threaten, or abuse other users; post illegal, hateful, sexually explicit, or violent content; impersonate others; spam or advertise without permission; attempt to hack, scrape, or reverse engineer the App; or use the App for any unlawful purpose. Random chat must be used only for good-faith English practice. We may monitor reports and remove access for violations.`,
  },
  {
    title: '6. User-Generated Content',
    body: `Messages and content you submit in chat or elsewhere are your responsibility. You grant us a limited licence to host, display, and process such content solely to operate the App. We do not endorse user content and may remove content that violates these Terms, Google Play User Generated Content policies, or applicable law.`,
  },
  {
    title: '6a. Photos, camera, and video',
    body: `${APP_INFO.appName} may request access to your camera, microphone, or photos only when you use features that need them (for example video lessons or practice). We do not access camera, microphone, or your photo library in the background. You must not upload or share illegal, harmful, sexual, violent, or infringing images or videos. We may remove content and suspend accounts that violate Google Play content policies.`,
  },
  {
    title: '7. Intellectual Property',
    body: `All App software, design, logos, course materials, game content, and daily word lists are owned by us or our licensors and protected by copyright and other laws. You receive a limited, non-exclusive, non-transferable licence to use the App for personal learning. You may not copy, resell, or distribute our content without permission.`,
  },
  {
    title: '8. Points, Rewards, and Leaderboard',
    body: `Points, daily rewards, journey bonuses, and leaderboard rankings are virtual incentives for engagement. They have no cash value, are non-transferable, and may be adjusted or reset if we detect abuse, cheating, or technical errors. We are not obligated to maintain any particular reward structure.`,
  },
  {
    title: '9. Purchases and Google Play Billing',
    body: `If paid courses or in-app products are offered, purchases made through Google Play are processed by Google under Google Play's billing terms. Refunds for those purchases follow Google Play refund policies unless required otherwise by law. Contact Google Play support for purchase-related billing issues where applicable.`,
  },
  {
    title: '10. Privacy',
    body: `We collect and use information such as email, profile details, learning progress, and device data as needed to provide and improve the App. Do not share sensitive personal data in random chat. See the in-app Privacy Policy (menu → legal) for photos, camera, video, and microphone use. Privacy questions: ${APP_INFO.email}.`,
  },
  {
    title: '11. Permissions',
    body: `The App requests permissions only when needed: Internet (courses, chat, login); Camera and microphone (video/voice practice you start). Each permission is explained when your device asks. You can revoke permissions in Settings. Denying permissions may limit related features.`,
  },
  {
    title: '12. Disclaimer of Warranties',
    body: `THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE UNINTERRUPTED SERVICE, ERROR-FREE OPERATION, OR SPECIFIC LEARNING OUTCOMES.`,
  },
  {
    title: '13. Limitation of Liability',
    body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL ARISING FROM YOUR USE OF THE APP. OUR TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM, OR ONE HUNDRED INDIAN RUPEES (₹100), WHICHEVER IS GREATER WHERE PERMITTED BY LAW.`,
  },
  {
    title: '14. Indemnification',
    body: `You agree to indemnify and hold us harmless from claims, damages, and expenses (including reasonable legal fees) arising from your misuse of the App, your user content, or your violation of these Terms or any third-party rights.`,
  },
  {
    title: '15. Termination',
    body: `You may stop using the App at any time. We may suspend or terminate your access without notice if you breach these Terms or if required for legal, security, or operational reasons. Sections that by nature should survive termination will remain in effect.`,
  },
  {
    title: '16. Changes to Terms',
    body: `We may update these Terms from time to time. Material changes will be reflected in the App. Continued use after changes constitutes acceptance. If you disagree with updated Terms, discontinue use of the App.`,
  },
  {
    title: '17. Governing Law and Disputes',
    body: `These Terms are governed by the laws of India, without regard to conflict-of-law principles. Courts in India shall have exclusive jurisdiction over disputes, subject to any mandatory consumer protections in your country of residence.`,
  },
  {
    title: '18. Contact',
    body: `Questions about these Terms: ${APP_INFO.email} | Phone: +91 ${APP_INFO.mobile} | WhatsApp: +91 ${APP_INFO.whatsapp}`,
  },
  {
    title: '19. Google Play',
    body: `When distributed via Google Play, you must comply with Google Play Developer Program Policies and Google Play's Terms of Service. Google is not responsible for the App or these Terms. For device or store issues, refer to Google Play Help.`,
  },
];

export const TERMS_LAST_UPDATED = '28 May 2026';
