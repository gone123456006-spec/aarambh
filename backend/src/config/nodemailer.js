const nodemailer = require('nodemailer');

const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,
  requireTLS: smtpPort === 587,
  auth: smtpConfigured
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS.replace(/\s/g, ''),
      }
    : undefined,
  tls: {
    minVersion: 'TLSv1.2',
  },
});

if (!smtpConfigured) {
  console.warn(
    '[SMTP] SMTP_USER / SMTP_PASS missing — OTP emails will not send. Use a Gmail App Password in backend/.env'
  );
} else {
  transporter.verify((err) => {
    if (err) {
      console.error('[SMTP] Connection failed:', err.message);
      console.error(
        '[SMTP] Use a Gmail App Password (16 chars), 2FA enabled, SMTP_USER = full Gmail address.'
      );
    } else {
      console.log(`[SMTP] Ready — sending as ${process.env.SMTP_USER}`);
    }
  });
}

module.exports = transporter;
module.exports.smtpConfigured = smtpConfigured;
