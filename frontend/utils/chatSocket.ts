import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '@/constants/socket';
import { getAccessToken } from '@/utils/authStorage';

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

export async function connectChatSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to chat with other learners.');
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Could not connect to chat server.'));
    }, 15000);

    socket!.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket!);
    });

    socket!.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(err.message || 'Chat connection failed'));
    });
  });
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
