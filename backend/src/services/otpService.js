const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const transporter = require('../config/nodemailer');
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
  const mailOptions = {
    from: `"Aarambh English" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Aarambh English - Verification OTP',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
        <h2 style="color: #e60000; text-align: center; margin-bottom: 20px;">Aarambh English Verification</h2>
        <p style="font-size: 16px; color: #333333; line-height: 1.5;">Hello,</p>
        <p style="font-size: 16px; color: #333333; line-height: 1.5;">Thank you for choosing Aarambh. Use the following 6-digit OTP to complete your verification. This code is valid for <b>${OTP_EXPIRY_MINUTES} minutes</b>:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #e60000; letter-spacing: 5px; padding: 10px 20px; background-color: #fff0f0; border-radius: 5px; border: 1px dashed #e60000;">${otpCode}</span>
        </div>
        <p style="font-size: 14px; color: #666666; line-height: 1.5; border-top: 1px solid #eeeeee; padding-top: 15px; margin-top: 30px;">If you did not request this verification, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('SMTP Email Error:', error);
    throw new ApiError(500, 'Failed to send OTP email. Please check SMTP configuration.');
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
