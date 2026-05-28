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

const sendOtpEmail = async (email, otpCode) => {
  const subject = 'OTP Verification';
  const htmlContent = buildOtpHtml(otpCode);
  const textBody = `Your OTP Code: ${otpCode}\nValid for ${OTP_EXPIRY_MINUTES} minutes.`;

  if (brevoConfigured && senderEmail) {
    try {
      await transactionalEmailsApi.sendTransacEmail({
        sender: { email: senderEmail, name: senderName },
        to: [{ email }],
        subject,
        htmlContent,
        textContent: textBody,
      });
      return;
    } catch (error) {
      console.error('Brevo API Email Error:', error?.response?.body || error);
      throw new ApiError(
        500,
        'Failed to send OTP email. Check BREVO_API_KEY and verified sender (SMTP_FROM) in backend/.env.'
      );
    }
  }

  if (!smtpConfigured) {
    throw new ApiError(
      500,
      'Email service is not configured. Set BREVO_API_KEY or SMTP_USER and SMTP_PASS in backend/.env.'
    );
  }

  try {
    await transporter.sendMail({
      from: `"${senderName}" <${smtpFrom}>`,
      to: email,
      subject,
      text: textBody,
      html: htmlContent,
    });
  } catch (error) {
    console.error('SMTP Email Error:', error);
    const hint =
      error.code === 'EAUTH'
        ? 'SMTP login failed. Prefer BREVO_API_KEY (no IP whitelist) or fix Brevo SMTP credentials.'
        : 'Check SMTP_* or BREVO_API_KEY in backend/.env.';
    throw new ApiError(500, `Failed to send OTP email. ${hint}`);
  }
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
};
