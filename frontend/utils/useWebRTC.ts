import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  emitWebRTCOffer,
  emitWebRTCAnswer,
  emitWebRTCIceCandidate,
} from './chatSocket';
import type { CallMode } from './mediaPermissions';
import { getWebRTC } from './webrtcNative';
import { getIceServers } from './webrtcConfig';
import { setCallAudioMode, configureRemoteAudio } from './audioRouting';

type MediaStreamLike = {
  getTracks: () => Array<{ stop: () => void }>;
  getAudioTracks: () => Array<{ enabled: boolean }>;
  getVideoTracks: () => Array<{ enabled: boolean }>;
  toURL: () => string;
};

type PeerConnectionLike = {
  addTrack: (track: unknown, stream: MediaStreamLike) => void;
  createOffer: (opts: object) => Promise<unknown>;
  createAnswer: () => Promise<unknown>;
  setLocalDescription: (desc: unknown) => Promise<void>;
  setRemoteDescription: (desc: unknown) => Promise<void>;
  addIceCandidate: (candidate: unknown) => Promise<void>;
  close: () => void;
  remoteDescription: unknown | null;
  ontrack: ((event: { streams?: MediaStreamLike[] }) => void) | null;
  onicecandidate: ((event: { candidate?: unknown }) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  iceConnectionState?: string;
  connectionState?: string;
};

function closePeerConnection(pc: PeerConnectionLike | null) {
  if (!pc) return;
  try {
    pc.close();
  } catch {
    // already closed
  }
}

function stopStream(stream: MediaStreamLike | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

function buildPeerConnection(
  stream: MediaStreamLike,
  sock: Socket,
  sessionId: string,
  onRemoteStream: (stream: MediaStreamLike) => void,
  onConnectionFailed: () => void
) {
  const webrtc = getWebRTC();
  if (!webrtc) throw new Error('WebRTC not available');

  const { RTCPeerConnection } = webrtc;
  const pc = new RTCPeerConnection({ iceServers: getIceServers() }) as unknown as PeerConnectionLike;

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  pc.ontrack = (event) => {
    if (event.streams?.[0]) {
      const remoteStream = event.streams[0];
      // Configure remote audio for maximum volume and clarity
      configureRemoteAudio(remoteStream);
      onRemoteStream(remoteStream);
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      emitWebRTCIceCandidate(sock, sessionId, event.candidate);
    }
  };

  const handleFailure = () => {
    const iceState = pc.iceConnectionState;
    const connState = pc.connectionState;
    if (iceState === 'failed' || connState === 'failed') {
      onConnectionFailed();
    }
  };

  pc.oniceconnectionstatechange = handleFailure;
  pc.onconnectionstatechange = handleFailure;

  return pc;
}

export function useWebRTC(
  sock: Socket | null,
  sessionId: string | null,
  onConnectionFailed?: () => void
) {
  const [localStream, setLocalStream] = useState<MediaStreamLike | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamLike | null>(null);
  const pcRef = useRef<PeerConnectionLike | null>(null);
  const localStreamRef = useRef<MediaStreamLike | null>(null);
  const remoteStreamRef = useRef<MediaStreamLike | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const onConnectionFailedRef = useRef(onConnectionFailed);

  useEffect(() => {
    onConnectionFailedRef.current = onConnectionFailed;
  }, [onConnectionFailed]);

  const flushIceCandidates = useCallback(async () => {
    const webrtc = getWebRTC();
    const pc = pcRef.current;
    if (!webrtc || !pc || !remoteDescriptionSetRef.current) return;

    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE candidate flush failed', e);
      }
    }
  }, []);

  const handleConnectionFailed = useCallback(() => {
    onConnectionFailedRef.current?.();
  }, []);

  const tearDownPeerConnection = useCallback(() => {
    closePeerConnection(pcRef.current);
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    stopStream(remoteStreamRef.current);
    remoteStreamRef.current = null;
    setRemoteStream(null);
  }, []);

  const getMedia = useCallback(async (mode: CallMode) => {
    const webrtc = getWebRTC();
    if (!webrtc) return null;

    // High-quality audio constraints for clear voice and video calls
    const stream = (await webrtc.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        sampleSize: 16,
        channelCount: 1,
      },
      video: mode === 'video' ? { facingMode: 'user' } : false,
    })) as MediaStreamLike;

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const prepareLocalMedia = useCallback(
    async (mode: CallMode = 'video'): Promise<boolean> => {
      if (!getWebRTC()) return false;
      try {
        const stream = localStreamRef.current ?? (await getMedia(mode));
        return !!stream;
      } catch (e) {
        console.error('Error preparing local media', e);
        return false;
      }
    },
    [getMedia]
  );

  const startCall = useCallback(
    async (mode: CallMode = 'video'): Promise<boolean> => {
      if (!sock || !sessionId || !getWebRTC()) return false;

      try {
        tearDownPeerConnection();

        // Configure audio routing for speaker output (loud, clear audio)
        await setCallAudioMode(mode, true);

        const stream = localStreamRef.current ?? (await getMedia(mode));
        if (!stream) return false;

        const pc = buildPeerConnection(
          stream,
          sock,
          sessionId,
          (remote) => {
            remoteStreamRef.current = remote;
            setRemoteStream(remote);
          },
          handleConnectionFailed
        );
        pcRef.current = pc;

        // Create offer with optimal constraints for audio quality
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: mode === 'video',
        });
        await pc.setLocalDescription(offer);
        emitWebRTCOffer(sock, sessionId, offer, mode);
        return true;
      } catch (e) {
        console.error('Error starting WebRTC call', e);
        return false;
      }
    },
    [sock, sessionId, getMedia, tearDownPeerConnection, handleConnectionFailed, flushIceCandidates]
  );

  const handleReceiveOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, mode: CallMode = 'video'): Promise<boolean> => {
      if (!sock || !sessionId || !getWebRTC()) return false;

      try {
        const webrtc = getWebRTC()!;
        tearDownPeerConnection();

        // Configure audio routing for speaker output (loud, clear audio)
        await setCallAudioMode(mode, true);

        let stream = localStreamRef.current;
        if (!stream) {
          stream = await getMedia(mode);
        }
        if (!stream) return false;

        const pc = buildPeerConnection(
          stream,
          sock,
          sessionId,
          (remote) => {
            remoteStreamRef.current = remote;
            setRemoteStream(remote);
          },
          handleConnectionFailed
        );
        pcRef.current = pc;

        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(offer));
        remoteDescriptionSetRef.current = true;
        await flushIceCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitWebRTCAnswer(sock, sessionId, answer);
        return true;
      } catch (e) {
        console.error('Error handling WebRTC offer', e);
        return false;
      }
    },
    [sock, sessionId, getMedia, tearDownPeerConnection, handleConnectionFailed, flushIceCandidates]
  );

  const handleReceiveAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit): Promise<boolean> => {
      try {
        const webrtc = getWebRTC();
        const pc = pcRef.current;
        if (!webrtc || !pc) return false;

        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(answer));
        remoteDescriptionSetRef.current = true;
        await flushIceCandidates();
        return true;
      } catch (e) {
        console.error('Error handling WebRTC answer', e);
        return false;
      }
    },
    [flushIceCandidates]
  );

  const handleReceiveIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      try {
        const webrtc = getWebRTC();
        const pc = pcRef.current;
        if (!webrtc || !pc) return;

        if (!remoteDescriptionSetRef.current && !pc.remoteDescription) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }

        await pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Error handling ICE candidate', e);
        pendingCandidatesRef.current.push(candidate);
      }
    },
    []
  );

  const endCall = useCallback(() => {
    tearDownPeerConnection();

    const stream = localStreamRef.current;
    if (stream) {
      stopStream(stream);
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Reset audio routing to default when call ends
    setCallAudioMode('video', false).catch((err) => {
      console.warn('Failed to reset audio mode:', err);
    });
  }, [tearDownPeerConnection]);

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  const toggleMic = useCallback((isMuted: boolean) => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, []);

  const toggleCamera = useCallback((isOff: boolean) => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isOff;
      });
    }
  }, []);

  return {
    localStream,
    remoteStream,
    prepareLocalMedia,
    startCall,
    handleReceiveOffer,
    handleReceiveAnswer,
    handleReceiveIceCandidate,
    endCall,
    toggleMic,
    toggleCamera,
  };
}
