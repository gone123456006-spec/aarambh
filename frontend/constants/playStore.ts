import { APP_INFO } from '@/constants/appInfo';

/** Permission strings shown on iOS/Android — required for Google Play (camera, mic, media). */
export const PLAY_STORE_PERMISSIONS = {
  camera:
    `${APP_INFO.appName} uses your camera only when you start video English practice. We do not record or upload video without your action.`,
  microphone:
    `${APP_INFO.appName} uses your microphone for voice and video lessons. Audio is used only for learning features you choose to use.`,
  photoLibrary:
    `${APP_INFO.appName} may access photos you select to share during practice. We do not access your gallery without your permission.`,
  notifications:
    `${APP_INFO.appName} may send learning reminders and account updates. You can turn off notifications in device settings.`,
};
