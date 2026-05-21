const User = require('../models/User');
const jwt = require('jsonwebtoken');
const otpService = require('../services/otpService');
const tokenService = require('../services/tokenService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Regular expression to restrict signup/login to Gmail accounts
const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i;

/**
 * Send OTP Verification code to Gmail account
 */
const sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!GMAIL_REGEX.test(trimmedEmail)) {
    throw new ApiError(400, 'Only Gmail (@gmail.com) accounts are allowed');
  }

  // Generate and send OTP
  const otpCode = otpService.generateOtpCode();
  
  // Send email via Gmail SMTP
  await otpService.sendOtpEmail(trimmedEmail, otpCode);
  
  // Save OTP code hashed in database (valid for 5 mins)
  await otpService.saveOtp(trimmedEmail, otpCode);

  res
    .status(200)
    .json(new ApiResponse(200, null, `OTP code successfully sent to ${trimmedEmail}`));
});

/**
 * Verify OTP, complete user registration or signin
 */
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    throw new ApiError(400, 'Email and OTP code are required');
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Verify the OTP code
  await otpService.verifyOtp(trimmedEmail, code);

  // OTP verified! Retrieve user if they exist, otherwise create them
  let user = await User.findOne({ email: trimmedEmail });
  let isNewUser = false;

  if (!user) {
    user = new User({ email: trimmedEmail });
    await user.save();
    isNewUser = true;
  }

  // Issue access and refresh tokens
  const accessToken = tokenService.generateAccessToken(user._id);
  const refreshToken = tokenService.generateRefreshToken(user._id);

  // Save refresh token to user profile (hashed)
  await tokenService.saveRefreshToken(user._id, refreshToken);

  // Store refresh token inside HTTP-only secure cookie
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching JWT expiration
  };

  // Determine if user profile is completed
  const isProfileComplete = !!(user.name && user.phone && user.gender && user.region && user.level);

  res
    .status(200)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            gender: user.gender,
            region: user.region,
            level: user.level,
            avatar: user.avatar,
            role: user.role,
          },
          accessToken,
          isNewUser,
          isProfileComplete,
        },
        'Authentication successful'
      )
    );
});

/**
 * Refresh JWT access token using the HTTP-only refresh cookie
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!oldRefreshToken) {
    throw new ApiError(401, 'Refresh token not found');
  }

  // Rotate tokens
  const tokens = await tokenService.rotateTokens(oldRefreshToken);

  // Set new refresh token in cookie
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res
    .status(200)
    .cookie('refreshToken', tokens.refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          accessToken: tokens.accessToken,
        },
        'Access token refreshed successfully'
      )
    );
});

/**
 * Revoke session and log out the user
 */
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (refreshToken) {
    // Revoke the refresh token from DB for security
    try {
      const decoded = jwt.decode(refreshToken);
      if (decoded && decoded.id) {
        await tokenService.revokeRefreshToken(decoded.id, refreshToken);
      }
    } catch (err) {
      // Decode/Revocation error can be ignored on logout
    }
  }

  // Clear HTTP-only cookie
  res
    .status(200)
    .clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })
    .json(new ApiResponse(200, null, 'Logged out successfully'));
});

module.exports = {
  sendOtp,
  verifyOtp,
  refreshAccessToken,
  logout,
};
