const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'node_modules', 'expo-image-picker', 'build');

function writeIfMissing(filePath, contents) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents, 'utf8');
    console.log(`[patch-expo-image-picker] Created ${path.relative(process.cwd(), filePath)}`);
  }
}

if (fs.existsSync(buildDir)) {
  writeIfMissing(
    path.join(buildDir, 'ImagePicker.types.js'),
    `export {};\n//# sourceMappingURL=ImagePicker.types.js.map\n`
  );

  writeIfMissing(
    path.join(buildDir, 'ImagePicker.types.d.ts'),
    `import type { PermissionResponse } from 'expo-modules-core';

export type MediaType = 'images' | 'videos' | 'livePhotos';
export type MediaTypeOptions = 'Images' | 'Videos' | 'All';
export type UIImagePickerPresentationStyle = string;

export type ImagePickerAsset = {
  uri: string;
  assetId?: string | null;
  width?: number;
  height?: number;
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo';
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
  duration?: number | null;
  base64?: string | null;
  exif?: Record<string, unknown> | null;
};

export type ImagePickerOptions = {
  mediaTypes?: MediaType[] | MediaTypeOptions;
  allowsEditing?: boolean;
  allowsMultipleSelection?: boolean;
  aspect?: [number, number];
  quality?: number;
  base64?: boolean;
  exif?: boolean;
  orderedSelection?: boolean;
  selectionLimit?: number;
  presentationStyle?: UIImagePickerPresentationStyle;
  videoMaxDuration?: number;
  videoQuality?: unknown;
  legacy?: boolean;
};

export type ImagePickerSuccessResult = {
  canceled: false;
  assets: ImagePickerAsset[];
};

export type ImagePickerCanceledResult = {
  canceled: true;
  assets: null;
};

export type ImagePickerResult = ImagePickerSuccessResult | ImagePickerCanceledResult;

export type ImagePickerErrorResult = {
  canceled: true;
  assets: null;
  code?: string;
  message?: string;
  exception?: string;
};

export type CameraPermissionResponse = PermissionResponse;
export type MediaLibraryPermissionResponse = PermissionResponse & {
  accessPrivileges?: 'all' | 'limited' | 'none';
};
`
  );
}
