import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PLAY_STORE_PERMISSIONS } from '@/constants/playStore';

/**
 * Opens the gallery / system photo picker for a single profile picture.
 * Does not use the camera. On Android 13+ uses the Play-compliant system picker.
 */
export async function pickProfileImageUri(): Promise<string | null> {
  if (Platform.OS === 'web') {
    Alert.alert('Not supported', 'Profile pictures can be changed in the mobile app.');
    return null;
  }

  // iOS only — limited photo library access for the single profile picture the user picks.
  if (Platform.OS === 'ios') {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync(false);
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
      granted = requested.granted;
    }
    if (!granted) {
      Alert.alert(
        'Photo access needed',
        `${PLAY_STORE_PERMISSIONS.profilePhoto}\n\nYou can enable Photos access in Settings.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    selectionLimit: 1,
    // Google Play: use Android system Photo Picker (no broad gallery access).
    legacy: Platform.OS === 'android' ? false : undefined,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}
