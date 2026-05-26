const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Hash a token using SHA-256 for secure DB storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate JWT Access Token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn:
        process.env.JWT_ACCESS_EXPIRY ||
        process.env.ACCESS_TOKEN_EXPIRE ||
        '15m',
    }
  );
};

/**
 * Generate JWT Refresh Token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn:
        process.env.JWT_REFRESH_EXPIRY ||
        process.env.REFRESH_TOKEN_EXPIRE ||
        '7d',
    }
  );
};

/**
 * Verify Refresh Token, rotate it, and return a new token pair
 */
const rotateTokens = async (oldRefreshToken) => {
  try {
    const decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, 'Invalid user session');
    }

    const oldTokenHash = hashToken(oldRefreshToken);

    // Check if the old refresh token exists in user's saved tokens
    const tokenIndex = user.refreshTokens.indexOf(oldTokenHash);

    if (tokenIndex === -1) {
      // Possible token reuse attack! Revoke all tokens to be safe
      user.refreshTokens = [];
      await user.save();
      throw new ApiError(401, 'Session hijacked. Please log in again.');
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    const newRefreshTokenHash = hashToken(newRefreshToken);

    // Replace the used refresh token with the new one
    user.refreshTokens[tokenIndex] = newRefreshTokenHash;
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
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
  generateRefreshToken,
  rotateTokens,
  saveRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
