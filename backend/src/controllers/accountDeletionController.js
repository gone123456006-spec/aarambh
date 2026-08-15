const accountDeletionService = require('../services/accountDeletionService');
const tokenService = require('../services/tokenService');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Request account deletion
 * POST /api/user/request-deletion
 */
const requestDeletion = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await accountDeletionService.requestAccountDeletion(userId);

  // After marking for deletion, clear the user's session
  await tokenService.clearDeviceSession(userId);

  res.status(200).json(
    new ApiResponse(
      200,
      result,
      'Account deletion scheduled. You will be logged out. Your account can be recovered by logging in within 7 days.'
    )
  );
});

/**
 * Cancel pending account deletion
 * POST /api/user/cancel-deletion
 */
const cancelDeletion = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await accountDeletionService.cancelAccountDeletion(userId);

  if (!result.wasCancelled) {
    res.status(200).json(new ApiResponse(200, result, 'No pending deletion to cancel'));
    return;
  }

  res.status(200).json(new ApiResponse(200, result, 'Account deletion cancelled successfully'));
});

/**
 * Get account deletion status
 * GET /api/user/deletion-status
 */
const getDeletionStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const status = await accountDeletionService.getDeletionStatus(userId);

  res.status(200).json(new ApiResponse(200, status, 'Deletion status retrieved'));
});

module.exports = {
  requestDeletion,
  cancelDeletion,
  getDeletionStatus,
};
