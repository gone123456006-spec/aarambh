import { NativeModules, Platform } from 'react-native';

export type WebRTCPackage = typeof import('react-native-webrtc');

let cached: WebRTCPackage | null | undefined;
let globalsRegistered = false;

/** True when the native WebRTC module is compiled into this app binary. */
export function isWebRTCAvailable(): boolean {
  return NativeModules.WebRTCModule != null;
}

/** Register WebRTC globals once (required for camera/mic + RTCView in dev builds). */
export function initWebRTC(): void {
  if (globalsRegistered || Platform.OS === 'web' || !isWebRTCAvailable()) return;
  try {
    const webrtc = getWebRTC();
    webrtc?.registerGlobals?.();
    globalsRegistered = true;
  } catch {
    // Native module missing or outdated binary — calls stay disabled.
  }
}

/** Lazy-load react-native-webrtc only when the native module exists. */
export function getWebRTC(): WebRTCPackage | null {
  if (cached !== undefined) return cached;
  if (!isWebRTCAvailable()) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-webrtc') as WebRTCPackage;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export const WEBRTC_REBUILD_HINT =
  'Voice and video calls require a native rebuild with WebRTC.\n\nFrom the frontend folder run:\n  npx expo run:android\n\nThen open the new dev build (not Expo Go).';
