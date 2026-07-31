const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/** Refresh sessions stay valid for years; only manual logout revokes them. */
const DEFAULT_REFRESH_EXPIRY = '3650d';
const REFRESH_COOKIE_MAX_AGE_MS = 3650 * 24 * 60 * 60 * 1000;
const TRANSFER_TOKEN_EXPIRY = '10m';
const DEVICE_MISMATCH_MESSAGE =
  'This account is active on another device. Please log in again.';
const DEVICE_ALREADY_ACTIVE_MESSAGE =
  'This account is already logged in on another device. Please log out from the previous device before signing in on this one.';

/**
 * Hash a token using SHA-256 for secure DB storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

function getRefreshExpiry() {
  return (
    process.env.JWT_REFRESH_EXPIRY ||
    process.env.REFRESH_TOKEN_EXPIRE ||
    DEFAULT_REFRESH_EXPIRY
  );
}

function getRefreshCookieMaxAgeMs() {
  const raw = process.env.JWT_REFRESH_COOKIE_MAX_AGE_MS;
  if (raw && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return REFRESH_COOKIE_MAX_AGE_MS;
}

function normalizeDeviceId(deviceId) {
  if (typeof deviceId !== 'string') return '';
  return deviceId.trim();
}

function assertDeviceMatches(user, deviceId) {
  const active = user.activeDeviceId ? String(user.activeDeviceId) : '';
  if (!active) return;
  const incoming = normalizeDeviceId(deviceId);
  if (!incoming || incoming !== active) {
    throw new ApiError(401, DEVICE_MISMATCH_MESSAGE, [], '', 'DEVICE_MISMATCH');
  }
}

/**
 * Generate JWT Access Token
 */
const generateAccessToken = (userId, expiresIn) => {
  return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn:
      expiresIn ||
      process.env.JWT_ACCESS_EXPIRY ||
      process.env.ACCESS_TOKEN_EXPIRE ||
      '7d',
  });
};

/** Longer-lived token for admin dashboard (default 24h) */
const generateAdminAccessToken = (userId) => {
  const expiry = process.env.ADMIN_TOKEN_EXPIRY || '24h';
  return generateAccessToken(userId, expiry);
};

/**
 * Generate JWT Refresh Token (long-lived; revoked only on logout)
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: getRefreshExpiry(),
  });
};

/** Short-lived token allowing device transfer after OTP verified a conflict. */
const generateTransferToken = (userId) => {
  return jwt.sign(
    { id: userId, purpose: 'device_transfer' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: TRANSFER_TOKEN_EXPIRY }
  );
};

const verifyTransferToken = (transferToken) => {
  try {
    const decoded = jwt.verify(transferToken, process.env.JWT_REFRESH_SECRET);
    if (decoded.purpose !== 'device_transfer' || !decoded.id) {
      throw new ApiError(401, 'Invalid transfer token');
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Transfer session expired. Please verify OTP again.');
  }
};

/**
 * Bind this device as the only active session: revoke all others, store device id,
 * and issue a fresh access + refresh token pair.
 */
const bindDeviceAndIssueTokens = async (userId, deviceId) => {
  const normalized = normalizeDeviceId(deviceId);
  if (!normalized || normalized.length < 8) {
    throw new ApiError(400, 'A valid device ID is required');
  }

  await User.findByIdAndUpdate(userId, {
    $set: {
      refreshTokens: [],
      activeDeviceId: normalized,
      activeDeviceBoundAt: new Date(),
    },
  });

  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  await saveRefreshToken(userId, refreshToken);

  return { accessToken, refreshToken, deviceId: normalized };
};

/**
 * Clear the active device binding and revoke every refresh token.
 */
const clearDeviceSession = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $set: {
      refreshTokens: [],
      activeDeviceId: null,
      activeDeviceBoundAt: null,
    },
  });
};

/**
 * Verify refresh token and issue a new access token.
 * Keep the same refresh token by default so restarts never orphan sessions.
 * If the refresh JWT is under 1 year from expiry, quietly upgrade it to a
 * long-lived token while still accepting the previous hash (grace).
 */
const rotateTokens = async (oldRefreshToken, deviceId) => {
  try {
    const decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, 'Invalid user session');
    }

    assertDeviceMatches(user, deviceId);

    const oldTokenHash = hashToken(oldRefreshToken);
    const tokenIndex = user.refreshTokens.indexOf(oldTokenHash);

    if (tokenIndex === -1) {
      throw new ApiError(401, 'Session revoked. Please log in again.');
    }

    const newAccessToken = generateAccessToken(user._id);
    let refreshOut = oldRefreshToken;

    const remainingMs = ((decoded.exp || 0) * 1000) - Date.now();
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

    // Upgrade older short-lived refresh tokens (e.g. previous 7d sessions)
    if (remainingMs < ONE_YEAR_MS) {
      const newRefreshToken = generateRefreshToken(user._id);
      const newHash = hashToken(newRefreshToken);
      user.refreshTokens[tokenIndex] = newHash;
      // Keep old hash briefly so a missed client save does not force re-login
      if (!user.refreshTokens.includes(oldTokenHash)) {
        user.refreshTokens.push(oldTokenHash);
      }
      if (user.refreshTokens.length > 20) {
        user.refreshTokens = user.refreshTokens.slice(-20);
      }
      await user.save();
      refreshOut = newRefreshToken;
    }

    return {
      accessToken: newAccessToken,
      refreshToken: refreshOut,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid session or token expired');
  }
};

/**
 * Save a new refresh token to user profile
 */
const saveRefreshToken = async (userId, refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  await User.findByIdAndUpdate(userId, {
    $push: { refreshTokens: tokenHash },
  });
};

/**
 * Revoke a specific refresh token (logout from one session)
 */
const revokeRefreshToken = async (userId, refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  await User.findByIdAndUpdate(userId, {
    $pull: { refreshTokens: tokenHash },
  });
};

/**
 * Revoke all refresh tokens (force logout from all sessions)
 */
const revokeAllRefreshTokens = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $set: { refreshTokens: [] },
  });
};

module.exports = {
  generateAccessToken,
  generateAdminAccessToken,
  generateRefreshToken,
  generateTransferToken,
  verifyTransferToken,
  bindDeviceAndIssueTokens,
  clearDeviceSession,
  rotateTokens,
  saveRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  assertDeviceMatches,
  normalizeDeviceId,
  getRefreshCookieMaxAgeMs,
  DEVICE_MISMATCH_MESSAGE,
  DEVICE_ALREADY_ACTIVE_MESSAGE,
};
