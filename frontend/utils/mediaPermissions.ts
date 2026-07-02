import { Alert, Linking, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import { PLAY_STORE_PERMISSIONS } from '@/constants/playStore';

export type CallMode = 'video' | 'voice';

export async function requestCallPermissions(mode: CallMode): Promise<boolean> {
  const mic = await Camera.requestMicrophonePermissionsAsync();
  if (!mic.granted) {
    showPermissionDeniedAlert('microphone');
    return false;
  }

  if (mode === 'video') {
    const cam = await Camera.requestCameraPermissionsAsync();
    if (!cam.granted) {
      showPermissionDeniedAlert('camera');
      return false;
    }
  }

  return true;
}

function showPermissionDeniedAlert(kind: 'camera' | 'microphone') {
  const message =
    kind === 'camera'
      ? PLAY_STORE_PERMISSIONS.camera
      : PLAY_STORE_PERMISSIONS.microphone;

  Alert.alert(
    kind === 'camera' ? 'Camera permission needed' : 'Microphone permission needed',
    `${message}\n\nEnable access in your device settings to use this feature.`,
    [
      { text: 'Not now', style: 'cancel' },
      ...(Platform.OS !== 'web'
        ? [{ text: 'Open settings', onPress: () => Linking.openSettings() }]
        : []),
    ]
  );
}
