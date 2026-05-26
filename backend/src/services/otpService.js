const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const transporter = require('../config/nodemailer');
const { smtpConfigured } = require('../config/nodemailer');
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
const sendOtpEmail = async (email, otpCode) => {
  if (!smtpConfigured) {
    throw new ApiError(
      500,
      'Email service is not configured. Set SMTP_USER and SMTP_PASS in backend/.env (Gmail App Password).'
    );
  }

  const mailOptions = {
    from: `"Aarambh English" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verification code',
    text: `Your verification code ${otpCode} for verification of Aarambh app.\n\nDo not share this verification code with anyone. Valid for ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this, ignore this email.`,
    html: `
      <div style="margin:0;padding:32px 16px;background-color:#f5f5f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e8e8e8;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="height:4px;background:linear-gradient(90deg,#e60000,#ff4d4d);"></div>
          <div style="padding:28px 24px 20px;">
            <p style="margin:0 0 20px;font-size:17px;line-height:1.6;color:#1a1a1a;">
              Your verification code
              <strong style="font-size:22px;color:#e60000;letter-spacing:3px;font-weight:700;">${otpCode}</strong>
              for verification of Aarambh app.
            </p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#888;">
              Valid for ${OTP_EXPIRY_MINUTES} minutes.
            </p>
          </div>
          <div style="padding:16px 24px 24px;background:#fafafa;border-top:1px solid #eee;">
            <p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#555;font-weight:600;">
              Disclaimer
            </p>
            <p style="margin:0;font-size:13px;line-height:1.55;color:#666;">
              Do not share this verification code with anyone — not even Aarambh staff. We will never ask for your code by phone, chat, or email.
            </p>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#999;">
              If you did not request this code, you can safely ignore this email.
            </p>
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('SMTP Email Error:', error);
    const hint =
      error.code === 'EAUTH'
        ? 'Gmail login failed. Use an App Password (not your normal password) in SMTP_PASS.'
        : 'Check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.';
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
