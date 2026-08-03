import { apiFetch, ApiRequestError } from '@/utils/api';
import { getDeviceId } from '@/utils/deviceId';
import { isProfileCompleteUser, type UserProfile } from '@/utils/profile';

type VerifyOtpData = {
  user: UserProfile & {
    id: string;
    email: string;
    avatar?: string;
    role?: string;
  };
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  isProfileComplete: boolean;
};

export type DeviceAlreadyActiveError = {
  code: 'DEVICE_ALREADY_ACTIVE';
  message: string;
  transferToken?: string;
};

export function resolveProfileComplete(
  data: Pick<VerifyOtpData, 'isProfileComplete' | 'isNewUser' | 'user'>
): boolean {
  if (data.isProfileComplete) return true;
  if (isProfileCompleteUser(data.user)) return true;
  return false;
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const res = await apiFetch<{ data: UserProfile }>('/api/users/me');
  return res.data;
}

export async function sendOtpEmail(email: string) {
  return apiFetch(
    '/api/auth/send-otp',
    {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    },
    false
  );
}

export async function verifyOtpCode(email: string, code: string): Promise<VerifyOtpData> {
  const deviceId = await getDeviceId();
  try {
    const res = await apiFetch<{ data: VerifyOtpData; message: string }>(
      '/api/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          deviceId,
        }),
      },
      false
    );
    return res.data;
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'DEVICE_ALREADY_ACTIVE') {
      const data = (e.data || {}) as { transferToken?: string; canTransfer?: boolean };
      const err = new Error(e.message) as Error & DeviceAlreadyActiveError;
      err.code = 'DEVICE_ALREADY_ACTIVE';
      err.message = e.message;
      err.transferToken = data.transferToken;
      throw err;
    }
    throw e;
  }
}

/**
 * Move the account session onto this device (logs out every other device).
 * Use after a blocked login (transferToken) or with a fresh email + OTP.
 */
export async function transferDeviceSession(payload: {
  transferToken?: string;
  email?: string;
  code?: string;
}): Promise<VerifyOtpData> {
  const deviceId = await getDeviceId();
  const body: Record<string, string> = { deviceId };
  if (payload.transferToken) body.transferToken = payload.transferToken;
  if (payload.email) body.email = payload.email.trim().toLowerCase();
  if (payload.code) body.code = payload.code;

  const res = await apiFetch<{ data: VerifyOtpData; message: string }>(
    '/api/auth/transfer-device',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    false
  );
  return res.data;
}

export async function logoutSession(refreshToken: string | null) {
  if (!refreshToken) return;
  const deviceId = await getDeviceId();
  // auth=false so we never rotate/refresh before revoke (avoids orphaning the session).
  await apiFetch(
    '/api/auth/logout',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken, deviceId }),
    },
    false
  );
}

export async function updateUserProfile(body: {
  name: string;
  phone: string;
  gender: string;
  region: string;
  level: string;
  referralCode?: string;
}) {
  const res = await apiFetch<{ data: VerifyOtpData['user'] }>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.data;
}

/** Permanently delete the signed-in account (Google Play account deletion requirement). */
export async function deleteMyAccount(): Promise<void> {
  await apiFetch('/api/users/me', { method: 'DELETE' });
}
