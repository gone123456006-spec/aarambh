/**
 * Test Brevo / SMTP from backend/.env
 *
 * Usage:
 *   node scripts/test-smtp.js
 *   node scripts/test-smtp.js recipient@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const nodemailer = require('nodemailer');

const to = process.argv[2] || process.env.SMTP_FROM || process.env.SMTP_USER;
const from = process.env.SMTP_FROM || process.env.SMTP_USER;

if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('Missing SMTP_HOST, SMTP_USER, or SMTP_PASS in backend/.env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: String(process.env.SMTP_PASS).replace(/\s/g, ''),
  },
});

async function sendMail() {
  try {
    await transporter.verify();
    console.log('[SMTP] Connection OK');

    const otp = Math.floor(100000 + Math.random() * 900000);

    const info = await transporter.sendMail({
      from: `"Ohm's English" <${from}>`,
      to,
      subject: 'Your OTP',
      text: `Your OTP is: ${otp}\nValid for 5 minutes`,
      html: `
        <h2>Your OTP is:</h2>
        <h1>${otp}</h1>
        <p>Valid for 5 minutes</p>
      `,
    });

    console.log('Mail sent:', info.messageId);
    console.log('To:', to);
    console.log('From:', from);
  } catch (err) {
    console.error('SMTP test failed:', err.message);
    if (err.response) console.error(err.response);
    process.exit(1);
  }
}

sendMail();
