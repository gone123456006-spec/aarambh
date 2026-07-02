export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/** STUN + optional TURN (set EXPO_PUBLIC_TURN_* for production NAT traversal). */
export function getIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL?.trim();
  const turnUser = process.env.EXPO_PUBLIC_TURN_USERNAME?.trim();
  const turnCred = process.env.EXPO_PUBLIC_TURN_CREDENTIAL?.trim();

  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnCred,
    });
  }

  return servers;
}

export const OUTGOING_CALL_TIMEOUT_MS = 45_000;
