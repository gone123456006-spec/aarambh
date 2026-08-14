import { Platform, NativeModules } from 'react-native';
import { isWebRTCAvailable } from './webrtcNative';
import type { CallMode } from './mediaPermissions';

const { AudioRoutingModule } = NativeModules;

/**
 * Configure audio routing for voice and video calls to ensure loud, clear audio.
 * Routes audio to speaker (not earpiece) for optimal volume.
 * Uses native module with Android 12+ API support.
 */
export async function setCallAudioMode(mode: CallMode, isActive: boolean): Promise<void> {
  if (!isWebRTCAvailable() || Platform.OS === 'web' || !AudioRoutingModule) {
    return;
  }

  try {
    // Use our custom native module that supports both Android 12+ and legacy APIs
    await AudioRoutingModule.enableSpeaker(isActive, mode);
  } catch (err) {
    console.warn('Audio routing configuration failed:', err);
  }
}

/**
 * Ensure optimal audio settings for remote stream playback.
 * Maximizes volume and applies best audio rendering settings.
 */
export function configureRemoteAudio(stream: MediaStream | any): void {
  if (!stream || typeof stream.getAudioTracks !== 'function') return;

  try {
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track: any) => {
      if (!track.enabled) return;

      // Set maximum volume if supported
      if ('volume' in track && typeof track.volume === 'number') {
        track.volume = 1.0;
      }

      // Apply audio settings for clarity
      const settings: any = track.getSettings?.() || {};
      const capabilities: any = track.getCapabilities?.() || {};

      // Request maximum audio quality settings if configurable
      const constraints: any = {};
      
      if (capabilities.echoCancellation !== undefined) {
        constraints.echoCancellation = true;
      }
      if (capabilities.noiseSuppression !== undefined) {
        constraints.noiseSuppression = true;
      }
      if (capabilities.autoGainControl !== undefined) {
        constraints.autoGainControl = true;
      }

      // Apply constraints if track supports applyConstraints
      if (Object.keys(constraints).length > 0 && typeof track.applyConstraints === 'function') {
        track.applyConstraints({ audio: constraints }).catch((err: Error) => {
          console.warn('Could not apply remote audio constraints:', err);
        });
      }
    });
  } catch (err) {
    console.warn('Remote audio configuration failed:', err);
  }
}
