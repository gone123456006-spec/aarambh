import { API_BASE_URL } from '@/constants/api';
import { getAccessToken } from '@/utils/authStorage';
import { getDeviceId } from '@/utils/deviceId';
import { ensureValidSession } from '@/utils/api';
import { resolveMediaUrl } from '@/utils/mediaUrl';

export type AvatarUploadResult = {
  avatar: string;
};

export async function uploadUserAvatar(localUri: string): Promise<string> {
  const sessionOk = await ensureValidSession();
  if (!sessionOk) {
    throw new Error('Please sign in to update your profile picture.');
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Please sign in to update your profile picture.');
  }

  const deviceId = await getDeviceId();
  const filename = localUri.split('/').pop() || 'avatar.jpg';
  const ext = filename.split('.').pop()?.toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const formData = new FormData();
  formData.append('avatar', {
    uri: localUri,
    name: filename.includes('.') ? filename : `${filename}.jpg`,
    type: mime,
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/api/users/avatar`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Device-Id': deviceId,
    },
    body: formData,
  });

  const json = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: AvatarUploadResult;
  };

  if (!response.ok || !json.data?.avatar) {
    throw new Error(json.message || 'Could not upload profile picture.');
  }

  return resolveMediaUrl(json.data.avatar);
}
