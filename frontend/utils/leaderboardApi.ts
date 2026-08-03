import { apiFetch, ensureValidSession } from '@/utils/api';
import { getTotalGameScore } from '@/utils/gameStats';

export type LeaderboardEntry = {
  id: string;
  name: string;
  points: number;
  location: string;
  avatar: string;
  rank: number;
  isMe?: boolean;
};

export type LeaderboardResponse = {
  rankings: LeaderboardEntry[];
  totalUsers: number;
  me: LeaderboardEntry;
};

export async function syncMyPointsToServer(points?: number): Promise<number> {
  const sessionOk = await ensureValidSession();
  if (!sessionOk) return points ?? 0;

  const score = points ?? (await getTotalGameScore());
  try {
    const res = await apiFetch<{ data: { totalPoints: number } }>('/api/users/me/points', {
      method: 'POST',
      body: JSON.stringify({ points: score }),
    });
    return res.data?.totalPoints ?? score;
  } catch {
    return score;
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const sessionOk = await ensureValidSession();
  if (!sessionOk) {
    throw new Error('Unable to refresh session. Check your connection and try again.');
  }

  await syncMyPointsToServer();

  const res = await apiFetch<{ data: LeaderboardResponse }>('/api/leaderboard');
  const data = res.data;

  if (!data?.rankings) {
    return {
      rankings: [],
      totalUsers: 0,
      me: {
        id: '',
        name: 'You',
        points: 0,
        location: '',
        avatar: '',
        rank: 0,
      },
    };
  }

  const meId = data.me?.id;
  const rankings = data.rankings.map((entry) => ({
    ...entry,
    isMe: meId ? entry.id === meId : false,
  }));

  return {
    ...data,
    rankings,
    me: {
      ...data.me,
      isMe: true,
    },
  };
}
