import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '@/constants/socket';
import { getAccessToken } from '@/utils/authStorage';
import { ensureValidSession, refreshAccessToken } from '@/utils/api';

export type ChatPeer = {
  id: string;
  name: string;
  location: string;
  region?: string;
  gender?: string;
  level?: string;
  avatar?: string;
};

export type ChatMessagePayload = {
  id: string;
  text: string;
  senderId: string;
  timestamp?: string;
};

type MatchFoundPayload = {
  sessionId: string;
  peer: ChatPeer;
};

let socket: Socket | null = null;

function attachReconnectAuthRefresh(sock: Socket) {
  sock.io.off('reconnect_attempt');
  sock.io.on('reconnect_attempt', async () => {
    await ensureValidSession();
    const fresh = await getAccessToken();
    if (fresh) {
      sock.auth = { token: fresh };
    }
  });
}

function openSocket(accessToken: string): Promise<Socket> {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(getSocketUrl(), {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Could not connect to chat server.'));
    }, 15000);

    const onConnect = () => {
      cleanup();
      attachReconnectAuthRefresh(socket!);
      resolve(socket!);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(new Error(err.message || 'Chat connection failed'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket?.off('connect', onConnect);
      socket?.off('connect_error', onError);
    };

    socket!.on('connect', onConnect);
    socket!.on('connect_error', onError);
  });
}

export async function connectChatSocket(): Promise<Socket> {
  if (socket?.connected) {
    await ensureValidSession();
    const fresh = await getAccessToken();
    if (fresh) {
      socket.auth = { token: fresh };
    }
    return socket;
  }

  const sessionOk = await ensureValidSession();
  let token = await getAccessToken();
  if (!sessionOk || !token) {
    throw new Error('Please sign in to chat with other learners.');
  }

  try {
    return await openSocket(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/auth|token|unauthorized|401/i.test(message)) {
      const refreshed = await refreshAccessToken();
      token = refreshed ? await getAccessToken() : null;
      if (token) {
        return openSocket(token);
      }
    }
    throw err instanceof Error ? err : new Error('Chat connection failed');
  }
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.emit('match:cancel');
    socket.disconnect();
    socket = null;
  }
}

export function startMatchmaking(sock: Socket) {
  sock.emit('match:start');
}

export function cancelMatchmaking(sock: Socket) {
  sock.emit('match:cancel');
}

export function sendChatMessage(
  sock: Socket,
  sessionId: string,
  text: string,
  clientId?: string
) {
  sock.emit('message:send', { sessionId, text, clientId });
}

export function emitMessageSeen(sock: Socket, sessionId: string, messageIds: string[]) {
  if (messageIds.length === 0) return;
  sock.emit('message:seen', { sessionId, messageIds });
}

export function skipChatPartner(sock: Socket, sessionId: string) {
  sock.emit('chat:skip', { sessionId });
}

export function emitTypingStart(sock: Socket, sessionId: string) {
  sock.emit('typing:start', { sessionId });
}

export function emitTypingStop(sock: Socket, sessionId: string) {
  sock.emit('typing:stop', { sessionId });
}

export type { MatchFoundPayload };
