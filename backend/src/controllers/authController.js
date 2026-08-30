const User = require('../models/User');
const jwt = require('jsonwebtoken');
const otpService = require('../services/otpService');
const tokenService = require('../services/tokenService');
const accountDeletionService = require('../services/accountDeletionService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const {
  isUserProfileComplete,
  ensureProfileCompletedFlag,
} = require('../utils/profileUtils');

// Regular expression to restrict signup/login to Gmail accounts
const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: tokenService.getRefreshCookieMaxAgeMs(),
  };
}

function buildAuthPayload(user, tokens, { isNewUser = false, deletionCancelled = false } = {}) {
  return {
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
      profileCompleted: user.profileCompleted,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewUser,
    isProfileComplete: isUserProfileComplete(user),
    deletionCancelled,
  };
}

async function sendLoginNotifications(user, isNewUser) {
  try {
    const notificationService = require('../services/notificationService');
    if (isNewUser) {
      await notificationService.notifyWelcome(user._id, {
        isNewUser: true,
        name: user.name || user.email,
      });
    } else {
      await notificationService.bootstrapUserNotifications(user._id, { isLogin: true });
    }
  } catch (err) {
    console.error('Welcome notification failed:', err.message || err);
  }
}

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

  // Google Play reviewer account — fixed OTP from env; no email sent (normal users unchanged)
  if (otpService.isPlayReviewerEmail(trimmedEmail)) {
    res
      .status(200)
      .json(new ApiResponse(200, null, `OTP code successfully sent to ${trimmedEmail}`));
    return;
  }

  // Generate and send OTP
  const otpCode = otpService.generateOtpCode();

  // Send email via SMTP (Brevo)
  const delivery = await otpService.sendOtpEmail(trimmedEmail, otpCode);

  // Save OTP code hashed in database (valid for 5 mins)
  await otpService.saveOtp(trimmedEmail, otpCode);

  const devPayload =
    delivery.devFallback && process.env.NODE_ENV === 'development'
      ? { devOtp: otpCode, emailDelivery: 'console' }
      : null;

  res
    .status(200)
    .json(new ApiResponse(200, devPayload, `OTP code successfully sent to ${trimmedEmail}`));
});

/**
 * Verify OTP, complete user registration or signin (single-device).
 * If another device holds the session, login is blocked and a short-lived
 * transferToken is returned so the user can move the session after confirming.
 */
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code, deviceId } = req.body;

  if (!email || !code) {
    throw new ApiError(400, 'Email and OTP code are required');
  }

  const normalizedDeviceId = tokenService.normalizeDeviceId(deviceId);
  if (!normalizedDeviceId || normalizedDeviceId.length < 8) {
    throw new ApiError(400, 'A valid device ID is required to sign in');
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Verify the OTP code
  await otpService.verifyOtp(trimmedEmail, code);

  // OTP verified! Retrieve user if they exist, otherwise create them
  let user = await User.findOne({ email: trimmedEmail });
  let isNewUser = false;
  let deletionCancelled = false;

  if (!user) {
    user = new User({ email: trimmedEmail, profileCompleted: false });
    await user.save();
    isNewUser = true;
  } else {
    user = await ensureProfileCompletedFlag(user);

    // Check for pending account deletion
    if (user.deletionPending) {
      const now = new Date();
      if (user.scheduledDeletionAt && user.scheduledDeletionAt <= now) {
        // Grace period expired - permanently delete the account
        await accountDeletionService.permanentlyDeleteAccount(user._id);
        throw new ApiError(
          410,
          'Your account has been permanently deleted as scheduled. The 7-day recovery period has expired.'
        );
      } else {
        // Grace period still active - cancel deletion and allow login
        await accountDeletionService.cancelAccountDeletion(user._id);
        deletionCancelled = true;
        // Re-fetch user to get updated deletion fields
        user = await User.findById(user._id);
      }
    }
  }

  // Block login when another device already holds this account
  const activeDeviceId = user.activeDeviceId ? String(user.activeDeviceId) : '';
  if (activeDeviceId && activeDeviceId !== normalizedDeviceId) {
    const transferToken = tokenService.generateTransferToken(user._id);
    throw new ApiError(
      403,
      tokenService.DEVICE_ALREADY_ACTIVE_MESSAGE,
      [],
      '',
      'DEVICE_ALREADY_ACTIVE',
      {
        canTransfer: true,
        transferToken,
      }
    );
  }

  const tokens = await tokenService.bindDeviceAndIssueTokens(user._id, normalizedDeviceId);
  await sendLoginNotifications(user, isNewUser);

  const message = deletionCancelled
    ? 'Welcome back! Your account deletion request has been cancelled. Your account is now active again.'
    : 'Authentication successful';

  res
    .status(200)
    .cookie('refreshToken', tokens.refreshToken, cookieOptions())
    .json(
      new ApiResponse(
        200,
        buildAuthPayload(user, tokens, { isNewUser, deletionCancelled }),
        message
      )
    );
});

/**
 * Transfer session to this device after identity verification.
 * Accepts either a short-lived transferToken (from blocked login) or a fresh email+OTP.
 */
const transferDevice = asyncHandler(async (req, res) => {
  const { transferToken, email, code, deviceId } = req.body;
  const normalizedDeviceId = tokenService.normalizeDeviceId(deviceId);

  if (!normalizedDeviceId || normalizedDeviceId.length < 8) {
    throw new ApiError(400, 'A valid device ID is required');
  }

  let user;

  if (transferToken) {
    const decoded = tokenService.verifyTransferToken(transferToken);
    user = await User.findById(decoded.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
  } else if (email && code) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!GMAIL_REGEX.test(trimmedEmail)) {
      throw new ApiError(400, 'Only Gmail (@gmail.com) accounts are allowed');
    }
    await otpService.verifyOtp(trimmedEmail, code);
    user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      throw new ApiError(404, 'No account found for this email');
    }
  } else {
    throw new ApiError(
      400,
      'Provide a transfer token, or email and OTP, to move this account to a new device'
    );
  }

  user = await ensureProfileCompletedFlag(user);

  // Check for pending account deletion
  let deletionCancelled = false;
  if (user.deletionPending) {
    const now = new Date();
    if (user.scheduledDeletionAt && user.scheduledDeletionAt <= now) {
      // Grace period expired - permanently delete the account
      await accountDeletionService.permanentlyDeleteAccount(user._id);
      throw new ApiError(
        410,
        'Your account has been permanently deleted as scheduled. The 7-day recovery period has expired.'
      );
    } else {
      // Grace period still active - cancel deletion and allow login
      await accountDeletionService.cancelAccountDeletion(user._id);
      deletionCancelled = true;
      // Re-fetch user to get updated deletion fields
      user = await User.findById(user._id);
    }
  }

  const tokens = await tokenService.bindDeviceAndIssueTokens(user._id, normalizedDeviceId);
  await sendLoginNotifications(user, false);

  const message = deletionCancelled
    ? 'Welcome back! Your account deletion request has been cancelled. Device transferred successfully.'
    : 'Device transferred successfully. Other devices have been logged out.';

  res
    .status(200)
    .cookie('refreshToken', tokens.refreshToken, cookieOptions())
    .json(
      new ApiResponse(
        200,
        buildAuthPayload(user, tokens, { isNewUser: false, deletionCancelled }),
        message
      )
    );
});

/**
 * Refresh JWT access token using the HTTP-only refresh cookie
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const deviceId =
    tokenService.normalizeDeviceId(req.headers['x-device-id']) ||
    tokenService.normalizeDeviceId(req.body?.deviceId);

  if (!oldRefreshToken) {
    throw new ApiError(401, 'Refresh token not found');
  }

  // Rotate tokens (also validates device binding)
  const tokens = await tokenService.rotateTokens(oldRefreshToken, deviceId);

  res
    .status(200)
    .cookie('refreshToken', tokens.refreshToken, cookieOptions())
    .json(
      new ApiResponse(
        200,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        'Access token refreshed successfully'
      )
    );
});

/**
 * Revoke session, clear device binding, and log out the user
 */
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const deviceId =
    tokenService.normalizeDeviceId(req.headers['x-device-id']) ||
    tokenService.normalizeDeviceId(req.body?.deviceId);

  if (refreshToken) {
    try {
      const decoded = jwt.decode(refreshToken);
      if (decoded && decoded.id) {
        const user = await User.findById(decoded.id).select('activeDeviceId');
        // Only the bound device (or unknown legacy session) may clear the lock.
        if (
          !user?.activeDeviceId ||
          !deviceId ||
          String(user.activeDeviceId) === deviceId
        ) {
          await tokenService.clearDeviceSession(decoded.id);
        } else {
          // Wrong device trying to logout — just revoke this refresh token if present
          await tokenService.revokeRefreshToken(decoded.id, refreshToken);
        }
      }
    } catch (err) {
      // Decode/Revocation error can be ignored on logout
    }
  }

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
  transferDevice,
  refreshAccessToken,
  logout,
};
