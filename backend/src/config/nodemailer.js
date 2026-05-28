const nodemailer = require('nodemailer');

const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpConfigured
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS.replace(/\s/g, ''),
      }
    : undefined,
});

const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

if (!smtpConfigured) {
  console.warn(
    '[SMTP] SMTP_USER / SMTP_PASS missing — OTP emails will not send. Set Brevo or Gmail SMTP in backend/.env'
  );
} else {
  transporter.verify((err) => {
    if (err) {
      console.error('[SMTP] Connection failed:', err.message);
      console.error(
        '[SMTP] Brevo: use SMTP login from Brevo → SMTP & API. Set SMTP_FROM to a verified sender email.'
      );
    } else {
      console.log(`[SMTP] Ready — host ${process.env.SMTP_HOST || 'smtp.gmail.com'}, from ${smtpFrom}`);
    }
  });
}

module.exports = transporter;
module.exports.smtpConfigured = smtpConfigured;
module.exports.smtpFrom = smtpFrom;
