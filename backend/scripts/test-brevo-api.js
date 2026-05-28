/**
 * Test Brevo Transactional API from backend/.env
 *
 * Usage:
 *   node scripts/test-brevo-api.js
 *   node scripts/test-brevo-api.js recipient@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const {
  transactionalEmailsApi,
  brevoConfigured,
  senderEmail,
  senderName,
} = require('../src/config/brevo');

async function sendEmail() {
  if (!brevoConfigured) {
    console.error('Set BREVO_API_KEY in backend/.env');
    process.exit(1);
  }
  if (!senderEmail) {
    console.error('Set SMTP_FROM or BREVO_SENDER_EMAIL (verified sender in Brevo).');
    process.exit(1);
  }

  const to = process.argv[2] || senderEmail;
  const otp = Math.floor(100000 + Math.random() * 900000);

  try {
    const result = await transactionalEmailsApi.sendTransacEmail({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject: 'OTP Verification',
      htmlContent: `
        <div style="font-family:sans-serif">
          <h2>Your OTP Code</h2>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `,
    });

    console.log('Brevo API OK:', result?.messageId || result);
    console.log('To:', to);
  } catch (err) {
    console.error('Brevo API failed:', err?.response?.body || err?.message || err);
    process.exit(1);
  }
}

sendEmail();
