import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL } from '@/constants/api';

export type AppUpdateInfo = {
  required: boolean;
  optional: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  currentBuildNumber: number;
  latestVersion: string;
  latestBuildNumber: number;
  storeUrl: string;
  message: string;
};

type VersionPolicyResponse = {
  data?: {
    android?: {
      minVersion?: string;
      latestVersion?: string;
      minBuildNumber?: number;
      latestBuildNumber?: number;
      forceUpdate?: boolean;
      storeUrl?: string;
    };
    message?: string;
  };
};

function getCurrentVersion(): string {
  return (
    Constants.expoConfig?.version ||
    (Constants.manifest2?.extra as { expoClient?: { version?: string } } | undefined)?.expoClient
      ?.version ||
    '0.0.0'
  );
}

function getCurrentBuildNumber(): number {
  const androidConfig = Constants.expoConfig?.android as { versionCode?: number } | undefined;
  const build = Number(androidConfig?.versionCode);
  return Number.isFinite(build) ? build : 0;
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => Number(part) || 0);
  const right = b.split('.').map((part) => Number(part) || 0);
  const len = Math.max(left.length, right.length);

  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  // Play Store update prompt is only relevant for Android release/dev-client builds.
  if (Platform.OS !== 'android') return null;

  const response = await fetch(`${API_BASE_URL}/api/app/version`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const json = (await response.json().catch(() => ({}))) as VersionPolicyResponse;
  const policy = json.data?.android;
  if (!response.ok || !policy) return null;

  const currentVersion = getCurrentVersion();
  const currentBuildNumber = getCurrentBuildNumber();
  const latestVersion = policy.latestVersion || policy.minVersion || currentVersion;
  const latestBuildNumber = Number(policy.latestBuildNumber || policy.minBuildNumber || 0);
  const minVersion = policy.minVersion || currentVersion;
  const minBuildNumber = Number(policy.minBuildNumber || 0);

  const belowMinimum =
    (minBuildNumber > 0 && currentBuildNumber > 0 && currentBuildNumber < minBuildNumber) ||
    compareVersions(currentVersion, minVersion) < 0;

  const belowLatest =
    (latestBuildNumber > 0 && currentBuildNumber > 0 && currentBuildNumber < latestBuildNumber) ||
    compareVersions(currentVersion, latestVersion) < 0;

  if (!belowMinimum && !belowLatest) return null;

  return {
    required: belowMinimum || policy.forceUpdate === true,
    optional: belowLatest && !belowMinimum && policy.forceUpdate !== true,
    forceUpdate: policy.forceUpdate === true,
    currentVersion,
    currentBuildNumber,
    latestVersion,
    latestBuildNumber,
    storeUrl:
      policy.storeUrl ||
      'https://play.google.com/store/apps/details?id=com.ohms.english',
    message:
      json.data?.message ||
      'A new version of Ohm\'s English is available. Please update from the Play Store.',
  };
}
