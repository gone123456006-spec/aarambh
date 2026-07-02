/**
 * Regenerates public legal HTML from privacyContent.ts / termsContent.ts sources.
 * Run: node frontend/scripts/sync-legal-html.js
 */
const fs = require('fs');
const path = require('path');

const APP = {
  appName: "Ohm's",
  email: 'aarambhfoundation111@gmail.com',
  mobile: '6204111878',
  whatsapp: '6204111878',
  privacyUrl: 'https://gone123456006-spec.github.io/aarambh/privacy-policy.html',
  termsUrl: 'https://gone123456006-spec.github.io/aarambh/terms-and-conditions.html',
  lastUpdated: '3 June 2026',
};

const STYLE = `
    body { font-family: Arial, sans-serif; margin: 0; background: #f8f9fa; color: #1f1f1f; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    .meta { color: #5f6368; margin-bottom: 20px; }
    .card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 18px; margin-bottom: 14px; }
    h2 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0; line-height: 1.6; }
    a { color: #c40000; text-decoration: none; }`;

function card(title, body) {
  return `    <div class="card"><h2>${title}</h2><p>${body}</p></div>`;
}

function page(title, meta, cards) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${STYLE}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${title}</h1>
    <div class="meta">${meta}</div>
${cards.join('\n')}
  </div>
</body>
</html>
`;
}

const privacyCards = [
  card('1. Overview', `This Privacy Policy explains how ${APP.appName} handles information when you use our English learning app on Google Play. Developer contact: ${APP.email}.`),
  card('2. Information we collect', 'Email and OTP codes; profile (name, phone, region, gender, learning level); learning progress, scores, and rewards; random chat messages; basic server logs for security. We do not sell personal information.'),
  card('3. Information we do not collect', 'We do not collect contacts, location, gallery photos/videos, SMS, call logs, advertising ID, or health/financial data.'),
  card('4. Camera and microphone', `${APP.appName} requests camera/microphone only when you tap to start video or voice practice. Live media is peer-to-peer between learners and is not recorded or stored on our servers. No background access. No photo gallery access.`),
  card('5. Random chat and user content', 'Chat messages are visible to matched partners during a session. Optional voice/video practice requires both users to accept. Automated filters apply. Skip or report users from chat or Contact Us. For English practice only — not dating.'),
  card('6. How we use information', 'Authentication, courses, games, chat matching, leaderboards, OTP email, support, and safety enforcement. No third-party advertising.'),
  card('7. Sharing', 'We share data only with hosting/email processors, when required by law, or for safety. We do not sell personal data.'),
  card('8. Security', 'We use reasonable safeguards including encryption in transit (HTTPS / secure chat connections).'),
  card('9. Retention', 'Data is kept while your account is active and as needed legally or operationally.'),
  card('10. Children', 'Not directed to children under 13. Under-18 users should have parental consent.'),
  card('11. Account deletion', `Delete your account in-app: Contact Us → Delete my account. Or email <a href="mailto:${APP.email}?subject=Account%20deletion%20request">${APP.email}</a> from your registered Gmail. Deletion removes profile, progress, and server data.`),
  card('12. Google Play', 'Our Google Play Data safety form matches this policy.'),
  card('13. Contact', `Email: <a href="mailto:${APP.email}">${APP.email}</a><br/>Phone: +91 ${APP.mobile}<br/><a href="terms-and-conditions.html">Terms &amp; Conditions</a>`),
];

const termsCards = [
  card('1. Acceptance', `By using ${APP.appName} you agree to these Terms and Google Play policies when installed from Google Play.`),
  card('2. Eligibility', 'Minimum age 13. Under-18 users need parental consent.'),
  card('3. Service', 'English courses, games, rewards, leaderboards, random chat for practice, and support. Educational use — not dating.'),
  card('4. Accounts', 'Gmail + OTP sign-in. You may delete your account from Contact Us.'),
  card('5. User conduct', 'No harassment, illegal content, spam, or misuse of chat. English practice only.'),
  card('6. User-generated content', 'You are responsible for chat content. We may filter, remove content, or suspend accounts per Google Play UGC policies.'),
  card('6a. Reporting', `Skip partners, use the report button in chat, or contact ${APP.email}.`),
  card('6b. Camera and microphone', 'Used only when you start related features. No gallery access.'),
  card('7. Privacy', `See <a href="privacy-policy.html">Privacy Policy</a>.`),
  card('8. Account deletion', 'Contact Us → Delete my account, or email support from your registered Gmail.'),
  card('9. Disclaimer', 'App provided "as is" without warranties.'),
  card('10. Contact', `Email: <a href="mailto:${APP.email}">${APP.email}</a><br/>Phone: +91 ${APP.mobile}`),
];

const privacyHtml = page("Ohm's Privacy Policy", `${APP.appName} English Learning — Last updated: ${APP.lastUpdated}`, privacyCards);
const termsHtml = page("Ohm's Terms & Conditions", `${APP.appName} English Learning — Last updated: ${APP.lastUpdated}`, termsCards);

const root = path.join(__dirname, '..', '..');
const targets = [
  path.join(root, 'docs', 'privacy-policy.html'),
  path.join(root, 'docs', 'terms-and-conditions.html'),
  path.join(root, 'play-console-assets', 'privacy-policy.html'),
  path.join(root, 'backend', 'public', 'legal', 'privacy-policy.html'),
  path.join(root, 'backend', 'public', 'legal', 'terms-and-conditions.html'),
];

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'public', 'legal'), { recursive: true });

fs.writeFileSync(path.join(root, 'docs', 'privacy-policy.html'), privacyHtml);
fs.writeFileSync(path.join(root, 'docs', 'terms-and-conditions.html'), termsHtml);
fs.writeFileSync(path.join(root, 'play-console-assets', 'privacy-policy.html'), privacyHtml);
fs.writeFileSync(path.join(root, 'backend', 'public', 'legal', 'privacy-policy.html'), privacyHtml);
fs.writeFileSync(path.join(root, 'backend', 'public', 'legal', 'terms-and-conditions.html'), termsHtml);

// Backend inline HTML module (escaped for JS template)
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
const backendPrivacy = privacyHtml.replace(/href="terms-and-conditions.html"/g, 'href="/terms-and-conditions"');
const backendTerms = termsHtml.replace(/href="privacy-policy.html"/g, 'href="/privacy-policy"');

const legalPagesJs = `/** Auto-generated by frontend/scripts/sync-legal-html.js — do not edit by hand. */
const privacyPolicyHtml = \`${esc(backendPrivacy)}\`;

const termsHtml = \`${esc(backendTerms)}\`;

module.exports = {
  privacyPolicyHtml,
  termsHtml,
};
`;

fs.writeFileSync(path.join(root, 'backend', 'src', 'content', 'legalPages.js'), legalPagesJs);

console.log('Legal HTML synced to docs/, play-console-assets/, backend/public/legal/, backend/src/content/legalPages.js');
