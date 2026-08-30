const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const transporter = require('../config/nodemailer');
const { smtpConfigured, smtpFrom } = require('../config/nodemailer');
const {
  transactionalEmailsApi,
  brevoConfigured,
  senderEmail,
  senderName,
} = require('../config/brevo');
const ApiError = require('../utils/ApiError');
const { OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS } = require('../utils/constants');

/** Google Play review login — optional env PLAY_REVIEWER_EMAIL + PLAY_REVIEWER_OTP only. */
function getPlayReviewerLogin() {
  const email = process.env.PLAY_REVIEWER_EMAIL?.trim().toLowerCase();
  const otp = process.env.PLAY_REVIEWER_OTP?.trim();
  if (!email || !otp || !/^\d{6}$/.test(otp)) {
    return null;
  }
  return { email, otp };
}

function isPlayReviewerEmail(email) {
  const cfg = getPlayReviewerLogin();
  return Boolean(cfg && email.trim().toLowerCase() === cfg.email);
}

function isPlayReviewerOtp(email, otpCode) {
  const cfg = getPlayReviewerLogin();
  if (!cfg) return false;
  return email.trim().toLowerCase() === cfg.email && String(otpCode).trim() === cfg.otp;
}

/**
 * Generate a 6-digit numeric OTP
 */
const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP to the specified Gmail address
 */
const buildOtpHtml = (otpCode) => `
  <div style="font-family:sans-serif">
    <h2>Your OTP Code</h2>
    <h1>${otpCode}</h1>
    <p>Valid for ${OTP_EXPIRY_MINUTES} minutes</p>
  </div>
`;

function isIpBlockedError(error) {
  const body = error?.response?.body;
  const combined = [
    body?.message,
    body?.code,
    error?.message,
    error?.code,
    error?.response,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    combined.includes('unrecognised ip') ||
    combined.includes('unrecognized ip') ||
    combined.includes('unauthorized ip') ||
    combined.includes('authorised_ips') ||
    combined.includes('authorized_ips') ||
    /525\s*5\.7\.1/.test(combined)
  );
}

function brevoIpBlockedMessage() {
  return (
    'Failed to send OTP email. Brevo blocked this server IP. ' +
    'In Brevo open Security → Authorized IPs, turn off "Authorize only listed IPs", ' +
    'or add your server IP: https://app.brevo.com/security/authorised_ips'
  );
}

async function sendViaBrevoApi(email, subject, htmlContent, textBody) {
  await transactionalEmailsApi.sendTransacEmail({
    sender: { email: senderEmail, name: senderName },
    to: [{ email }],
    subject,
    htmlContent,
    textContent: textBody,
  });
}

async function sendViaSmtp(email, subject, htmlContent, textBody) {
  await transporter.sendMail({
    from: `"${senderName}" <${smtpFrom}>`,
    to: email,
    subject,
    text: textBody,
    html: htmlContent,
  });
}

function logEmailAttemptFailure(channel, error) {
  const quietDev =
    process.env.NODE_ENV === 'development' &&
    !/^(0|false|no)$/i.test(String(process.env.OTP_DEV_CONSOLE || 'true').trim());

  if (quietDev && isIpBlockedError(error)) {
    return;
  }

  if (channel === 'brevo') {
    console.error('Brevo API Email Error:', error?.response?.body || error);
    return;
  }

  console.error('SMTP Email Error:', error);
}

const sendOtpEmail = async (email, otpCode) => {
  const subject = 'OTP Verification';
  const htmlContent = buildOtpHtml(otpCode);
  const textBody = `Your OTP Code: ${otpCode}\nValid for ${OTP_EXPIRY_MINUTES} minutes.`;
  const errors = [];

  if (brevoConfigured && senderEmail) {
    try {
      await sendViaBrevoApi(email, subject, htmlContent, textBody);
      return { delivered: true, devFallback: false };
    } catch (error) {
      logEmailAttemptFailure('brevo', error);
      errors.push(error);
    }
  }

  if (smtpConfigured) {
    try {
      await sendViaSmtp(email, subject, htmlContent, textBody);
      return { delivered: true, devFallback: false };
    } catch (error) {
      logEmailAttemptFailure('smtp', error);
      errors.push(error);
    }
  }

  if (!brevoConfigured && !smtpConfigured) {
    throw new ApiError(
      500,
      'Email service is not configured. Set BREVO_API_KEY or SMTP_USER and SMTP_PASS in backend/.env.'
    );
  }

  const devConsoleOk =
    process.env.NODE_ENV === 'development' &&
    !/^(0|false|no)$/i.test(String(process.env.OTP_DEV_CONSOLE || 'true').trim());

  if (devConsoleOk) {
    console.warn(
      `[DEV] OTP for ${email}: ${otpCode} — Brevo blocked this IP. ` +
        'Use the code above to sign in, or fix: https://app.brevo.com/security/authorised_ips'
    );
    return { delivered: false, devFallback: true };
  }

  if (errors.some(isIpBlockedError)) {
    throw new ApiError(500, brevoIpBlockedMessage());
  }

  const last = errors[errors.length - 1];
  const hint =
    last?.code === 'EAUTH'
      ? 'SMTP login failed. Check Brevo SMTP credentials in backend/.env.'
      : 'Check BREVO_API_KEY, SMTP_* and verified sender (SMTP_FROM) in backend/.env.';
  throw new ApiError(500, `Failed to send OTP email. ${hint}`);
};

/**
 * Save OTP to database after hashing it
 */
const saveOtp = async (email, otpCode) => {
  // Delete any existing OTP for this email
  await Otp.deleteMany({ email });

  const salt = await bcrypt.genSalt(10);
  const hashedCode = await bcrypt.hash(otpCode, salt);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const otp = new Otp({
    email,
    code: hashedCode,
    expiresAt,
  });

  await otp.save();
};

/**
 * Verify OTP code
 */
const verifyOtp = async (email, otpCode) => {
  if (isPlayReviewerOtp(email, otpCode)) {
    return true;
  }

  const otpDoc = await Otp.findOne({ email });

  if (!otpDoc) {
    throw new ApiError(400, 'OTP expired or not found. Please request a new one.');
  }

  // Check expiration time manually as well just in case
  if (otpDoc.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: otpDoc._id });
    throw new ApiError(400, 'OTP expired. Please request a new one.');
  }

  // Check maximum attempts
  if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
    await Otp.deleteOne({ _id: otpDoc._id });
    throw new ApiError(400, 'Too many invalid attempts. Please request a new OTP.');
  }

  const isMatch = await bcrypt.compare(otpCode, otpDoc.code);

  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    throw new ApiError(400, `Invalid OTP. Attempts remaining: ${MAX_OTP_ATTEMPTS - otpDoc.attempts}`);
  }

  // Successful verification
  await Otp.deleteOne({ _id: otpDoc._id });
  return true;
};

module.exports = {
  generateOtpCode,
  sendOtpEmail,
  saveOtp,
  verifyOtp,
  isPlayReviewerEmail,
};
