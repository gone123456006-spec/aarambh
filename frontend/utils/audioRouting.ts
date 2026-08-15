import { Platform, NativeModules } from 'react-native';
import type { CallMode } from './mediaPermissions';

const { AudioRoutingModule } = NativeModules;

type AudioRoutingNative = {
  enableSpeaker: (enable: boolean, mode: CallMode | string) => Promise<boolean>;
  setSpeakerOn?: (speakerOn: boolean) => Promise<boolean>;
  isSpeakerEnabled?: () => Promise<boolean>;
};

function nativeModule(): AudioRoutingNative | null {
  if (!AudioRoutingModule) return null;
  return AudioRoutingModule as AudioRoutingNative;
}

/** WhatsApp-style default: video uses loudspeaker, voice uses earpiece. */
export function defaultCallSpeakerOn(mode: CallMode): boolean {
  return mode === 'video';
}

async function applyExpoSpeaker(speakerOn: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { Audio } = require('expo-av') as typeof import('expo-av');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: !speakerOn,
    });
  } catch (err) {
    console.warn('Expo audio routing failed:', err);
  }
}

async function applyNativeSpeaker(speakerOn: boolean): Promise<void> {
  const native = nativeModule();
  if (!native) return;

  try {
    if (typeof native.setSpeakerOn === 'function') {
      await native.setSpeakerOn(speakerOn);
      return;
    }
    if (typeof native.enableSpeaker === 'function') {
      // Keep the call audio session active (first arg must stay true).
      await native.enableSpeaker(true, speakerOn ? 'video' : 'voice');
    }
  } catch (err) {
    console.warn('Native speaker toggle failed:', err);
  }
}

/**
 * Start or stop in-call audio session.
 * Video defaults to loudspeaker; voice defaults to earpiece.
 */
export async function setCallAudioMode(mode: CallMode, isActive: boolean): Promise<void> {
  if (Platform.OS === 'web') return;

  const native = nativeModule();
  if (native?.enableSpeaker) {
    try {
      await native.enableSpeaker(isActive, mode);
    } catch (err) {
      console.warn('Audio routing configuration failed:', err);
    }
  }

  if (isActive) {
    await applyExpoSpeaker(defaultCallSpeakerOn(mode));
  } else {
    await applyExpoSpeaker(false);
  }
}

/**
 * Toggle loudspeaker while a call is active (WhatsApp speaker button).
 * true = loudspeaker, false = earpiece.
 */
export async function setCallSpeakerOn(speakerOn: boolean): Promise<void> {
  if (Platform.OS === 'web') return;

  await applyNativeSpeaker(speakerOn);
  await applyExpoSpeaker(speakerOn);

  // WebRTC often resets the route after the remote track starts.
  setTimeout(() => {
    void applyNativeSpeaker(speakerOn);
  }, 300);
}

/**
 * Ensure optimal audio settings for remote stream playback.
 */
export function configureRemoteAudio(stream: MediaStream | { getAudioTracks?: () => Array<{ enabled: boolean; volume?: number; getSettings?: () => object; getCapabilities?: () => object; applyConstraints?: (c: object) => Promise<void> }> }): void {
  if (!stream || typeof stream.getAudioTracks !== 'function') return;

  try {
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track) => {
      if (!track.enabled) return;

      if ('volume' in track && typeof track.volume === 'number') {
        track.volume = 1.0;
      }

      const capabilities = (typeof track.getCapabilities === 'function' ? track.getCapabilities() : {}) as {
        echoCancellation?: boolean;
        noiseSuppression?: boolean;
        autoGainControl?: boolean;
      };

      const constraints: Record<string, boolean> = {};
      if (capabilities.echoCancellation !== undefined) constraints.echoCancellation = true;
      if (capabilities.noiseSuppression !== undefined) constraints.noiseSuppression = true;
      if (capabilities.autoGainControl !== undefined) constraints.autoGainControl = true;

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
