import { apiFetch } from '@/utils/api';
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

export async function verifyOtpCode(email: string, code: string) {
  const res = await apiFetch<{ data: VerifyOtpData; message: string }>(
    '/api/auth/verify-otp',
    {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code,
      }),
    },
    false
  );
  return res.data;
}

export async function logoutSession(refreshToken: string | null) {
  if (!refreshToken) return;
  await apiFetch(
    '/api/auth/logout',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    },
    true
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
