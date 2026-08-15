const express = require('express');
const ApiResponse = require('../utils/ApiResponse');
const homeHeroController = require('../controllers/homeHeroController');
const notificationController = require('../controllers/notificationController');
const accountDeletionController = require('../controllers/accountDeletionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE_NAME || 'com.ohms.english';
const DEFAULT_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Public app-update policy used by the mobile app on launch/foreground.
 * Update these env vars after a new Play Store version is available.
 */
router.get('/version', (req, res) => {
  const android = {
    packageName: ANDROID_PACKAGE,
    minVersion: process.env.ANDROID_MIN_VERSION || '1.0.1',
    latestVersion: process.env.ANDROID_LATEST_VERSION || process.env.ANDROID_MIN_VERSION || '1.0.1',
    minBuildNumber: numberFromEnv(process.env.ANDROID_MIN_BUILD_NUMBER, 2),
    latestBuildNumber: numberFromEnv(
      process.env.ANDROID_LATEST_BUILD_NUMBER,
      numberFromEnv(process.env.ANDROID_MIN_BUILD_NUMBER, 2)
    ),
    forceUpdate: /^(1|true|yes)$/i.test(String(process.env.ANDROID_FORCE_UPDATE || '1')),
    storeUrl: process.env.ANDROID_STORE_URL || DEFAULT_STORE_URL,
  };

  res.status(200).json(
    new ApiResponse(
      200,
      {
        android,
        message:
          process.env.APP_UPDATE_MESSAGE ||
          'A new version of Ohm\'s English is available. Please update from the Play Store to continue.',
      },
      'App version policy retrieved successfully'
    )
  );
});

router.get('/home-hero', homeHeroController.getPublicHero);

// Device token management (requires authentication)
router.post('/device-token', protect, notificationController.registerDeviceToken);
router.delete('/device-token', protect, notificationController.unregisterDeviceToken);
router.post('/test-notification', protect, notificationController.testNotification);

// Account deletion (requires authentication)
router.post('/user/request-deletion', protect, accountDeletionController.requestDeletion);
router.post('/user/cancel-deletion', protect, accountDeletionController.cancelDeletion);
router.get('/user/deletion-status', protect, accountDeletionController.getDeletionStatus);

module.exports = router;
