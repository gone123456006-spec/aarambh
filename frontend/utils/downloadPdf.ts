import {
  cacheDirectory,
  copyAsync,
  documentDirectory,
  downloadAsync,
  EncodingType,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const DOWNLOADS_FOLDER_URI_KEY = '@ohms_android_downloads_folder_uri';

export type PdfDownloadResult = {
  savedPath: string;
  locationLabel: string;
};

function sanitizePdfFilename(title: string): string {
  const base = String(title || 'lesson-notes')
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '-')
    .trim()
    .slice(0, 72);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'lesson-notes'}.pdf`;
}

async function readFileBase64(uri: string): Promise<string> {
  return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
}

async function writeBase64ToSafUri(destUri: string, base64: string): Promise<void> {
  await writeAsStringAsync(destUri, base64, { encoding: EncodingType.Base64 });
}

async function getAndroidDownloadsFolderUri(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(DOWNLOADS_FOLDER_URI_KEY);
  return saved || null;
}

async function pickAndroidDownloadsFolder(): Promise<string> {
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted || !perm.directoryUri) {
    throw new Error('Downloads folder access was not granted.');
  }
  await AsyncStorage.setItem(DOWNLOADS_FOLDER_URI_KEY, perm.directoryUri);
  return perm.directoryUri;
}

async function savePdfToAndroidDownloads(localUri: string, filename: string): Promise<PdfDownloadResult> {
  let folderUri = await getAndroidDownloadsFolderUri();
  if (!folderUri) {
    const shouldPick = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Save to Downloads',
        'Choose your Downloads folder once. After that, Ohm\'s will save lesson PDFs there automatically.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Choose Downloads', onPress: () => resolve(true) },
        ]
      );
    });
    if (!shouldPick) {
      throw new Error('Downloads folder not selected.');
    }
    folderUri = await pickAndroidDownloadsFolder();
  }

  try {
    const base64 = await readFileBase64(localUri);
    const destUri = await StorageAccessFramework.createFileAsync(
      folderUri,
      filename.replace(/\.pdf$/i, ''),
      'application/pdf'
    );
    await writeBase64ToSafUri(destUri, base64);
    return { savedPath: destUri, locationLabel: 'Downloads folder' };
  } catch {
    await AsyncStorage.removeItem(DOWNLOADS_FOLDER_URI_KEY);
    throw new Error('Could not save to Downloads. Try again and re-select your Downloads folder.');
  }
}

async function savePdfToIosDocuments(localUri: string, filename: string): Promise<PdfDownloadResult> {
  const docPath = `${documentDirectory}${filename}`;
  await copyAsync({ from: localUri, to: docPath });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(docPath, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Save PDF',
    });
  }
  return { savedPath: docPath, locationLabel: 'Files / Ohm\'s storage' };
}

/**
 * Download a lesson PDF and save it on the device (Downloads on Android).
 */
export async function downloadLessonPdf(pdfUrl: string, title: string): Promise<PdfDownloadResult> {
  const resolvedUrl = resolveMediaUrl(pdfUrl);
  if (!resolvedUrl) {
    throw new Error('PDF link is not available yet.');
  }

  const filename = sanitizePdfFilename(title);
  if (!cacheDirectory) {
    throw new Error('Device storage is not available.');
  }
  const tempPath = `${cacheDirectory}${Date.now()}-${filename}`;

  const downloaded = await downloadAsync(resolvedUrl, tempPath);
  if (downloaded.status !== 200) {
    throw new Error(`Download failed (${downloaded.status}). Ask admin to re-upload the PDF.`);
  }

  if (Platform.OS === 'android') {
    try {
      return await savePdfToAndroidDownloads(downloaded.uri, filename);
    } catch (error) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save PDF to Downloads',
        });
        return { savedPath: downloaded.uri, locationLabel: 'Share menu' };
      }
      throw error;
    }
  }

  return savePdfToIosDocuments(downloaded.uri, filename);
}
