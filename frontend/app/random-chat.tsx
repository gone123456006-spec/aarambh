import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  StatusBar,
  TouchableOpacity,
  Pressable,
  TextInput,
  FlatList,
  Image,
  Alert,
  Keyboard,
  Linking,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, runOnJS } from 'react-native-reanimated';
import {
  connectChatSocket,
  disconnectChatSocket,
  startMatchmaking,
  cancelMatchmaking,
  sendChatMessage,
  skipChatPartner,
  emitTypingStart,
  emitTypingStop,
  emitMessageSeen,
  getChatSocket,
  startVideoCall,
  acceptVideoCall,
  rejectVideoCall,
  endVideoCall,
  type ChatPeer,
} from '@/utils/chatSocket';
import type { Socket } from 'socket.io-client';
import { AUTH_KEYS } from '@/utils/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureValidSession } from '@/utils/api';
import { MatchmakingScene } from '@/components/MatchmakingScene';
import { ChatTypingBubble } from '@/components/ChatTypingBubble';
import UserAvatar from '@/components/UserAvatar';
import { AppUI, cardShadow } from '@/constants/theme';
import { APP_INFO } from '@/constants/appInfo';
import { validateChatMessage, isChatMessageBlocked } from '@/utils/chatMessageValidation';
import { getNavBarTopPadding } from '@/utils/safeAreaInsets';
import { useWebRTC } from '@/utils/useWebRTC';
import { WebRTCVideo } from '@/components/WebRTCVideo';
import { requestCallPermissions, type CallMode } from '@/utils/mediaPermissions';
import { isWebRTCAvailable, WEBRTC_REBUILD_HINT } from '@/utils/webrtcNative';
import { OUTGOING_CALL_TIMEOUT_MS } from '@/utils/webrtcConfig';

const UI = AppUI;
/** WhatsApp-style chat chrome */
const WA = {
  header: '#075E54',
  headerLight: '#128C7E',
  chatBg: '#ECE5DD',
  typing: '#25D366',
  icon: '#FFFFFF',
  subtitle: 'rgba(255,255,255,0.78)',
};
const BUBBLE_SELF_BG = '#5b9bd5';
const TICK_COLOR = UI.accent;
const TICK_COLOR_READ = '#ff3333';

function formatMessageTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

const EXTRA_LIST_SPACING = 12;
const SCROLL_AFTER_KEYBOARD_MS = Platform.OS === 'android' ? 280 : 160;
/** Fallback when Android does not report keyboard height in JS */
const ANDROID_KEYBOARD_FALLBACK = 280;
const DEFAULT_INPUT_DOCK_HEIGHT = Platform.OS === 'android' ? 64 : 56;
/** Android 3-button nav bar — insets.bottom is often 0 in Expo Go */
const ANDROID_NAV_BAR_HEIGHT = 48;
const ENCRYPTION_NOTICE_MS = 4500;

type CallPhase = 'idle' | 'ringing-in' | 'ringing-out' | 'accepted';

type MessageStatus = 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  text: string;
  isSelf: boolean;
  time: string;
  status?: MessageStatus;
}

function PeerAvatar({ peer, size = 40 }: { peer: ChatPeer; size?: number }) {
  return <UserAvatar name={peer.name} avatar={peer.avatar} size={size} />;
}

export default function RandomChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ intent?: string | string[] }>();
  const intentRaw = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  const callIntent = intentRaw === 'call' || intentRaw === 'voice';
  const [status, setStatus] = useState<'connecting' | 'searching' | 'chat' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [peer, setPeer] = useState<ChatPeer | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState('');
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [callMode, setCallMode] = useState<CallMode | null>(null);
  const [outgoingCallPending, setOutgoingCallPending] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const sessionIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputDockHeight, setInputDockHeight] = useState(DEFAULT_INPUT_DOCK_HEIGHT);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [showEncryptionNotice, setShowEncryptionNotice] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallMode | null>(null);
  const mountedRef = useRef(true);
  const myUserIdRef = useRef('');
  const callPhaseRef = useRef<CallPhase>('idle');
  const outgoingCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onConnectionFailedRef = useRef<() => void>(() => { });
  const autoCallStartedForSessionRef = useRef<string | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachChatHandlersRef = useRef<(sock: Socket) => void>(() => { });
  const callIntentRef = useRef(callIntent);
  callIntentRef.current = callIntent;

  const clearOutgoingCallTimeout = useCallback(() => {
    if (outgoingCallTimeoutRef.current) {
      clearTimeout(outgoingCallTimeoutRef.current);
      outgoingCallTimeoutRef.current = null;
    }
  }, []);

  const {
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
  } = useWebRTC(getChatSocket(), sessionId, () => onConnectionFailedRef.current());

  const webrtcRef = useRef({
    prepareLocalMedia,
    startCall,
    handleReceiveOffer,
    handleReceiveAnswer,
    handleReceiveIceCandidate,
    endCall,
  });

  useEffect(() => {
    webrtcRef.current = {
      prepareLocalMedia,
      startCall,
      handleReceiveOffer,
      handleReceiveAnswer,
      handleReceiveIceCandidate,
      endCall,
    };
  }, [prepareLocalMedia, startCall, handleReceiveOffer, handleReceiveAnswer, handleReceiveIceCandidate, endCall]);

  const resetCallState = useCallback(() => {
    callPhaseRef.current = 'idle';
    clearOutgoingCallTimeout();
    setIncomingCall(null);
    setIsVideoCallActive(false);
    setCallMode(null);
    setOutgoingCallPending(false);
    setIsMicMuted(false);
    setIsCameraOff(false);
    webrtcRef.current.endCall();
  }, [clearOutgoingCallTimeout]);

  /** End the active call. Chat mode returns to the thread; Call in English stays on call UI. */
  const endCallAndReturnToChat = useCallback(() => {
    const sock = getChatSocket();
    const sid = sessionIdRef.current;
    if (sock && sid) endVideoCall(sock, sid);
    resetCallState();
  }, [resetCallState]);

  const isInCallUi = isVideoCallActive || outgoingCallPending;

  useEffect(() => {
    if (!isInCallUi) return;
    Keyboard.dismiss();
  }, [isInCallUi]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (isInCallUi) {
      void SystemUI.setBackgroundColorAsync('#000000');
      return () => {
        void SystemUI.setBackgroundColorAsync(WA.header);
      };
    }
  }, [isInCallUi]);

  useEffect(() => {
    onConnectionFailedRef.current = () => {
      const sock = getChatSocket();
      const sid = sessionIdRef.current;
      if (sock && sid) endVideoCall(sock, sid);
      resetCallState();
      Alert.alert('Call failed', 'Could not connect. Check your network and try again.');
    };
  }, [resetCallState]);

  const failCallNegotiation = useCallback(
    (message: string) => {
      const sock = getChatSocket();
      const sid = sessionIdRef.current;
      if (sock && sid) endVideoCall(sock, sid);
      resetCallState();
      Alert.alert('Call failed', message);
    },
    [resetCallState]
  );

  const appendMessage = useCallback(
    (
      text: string,
      isSelf: boolean,
      id?: string,
      time?: string,
      status?: MessageStatus
    ) => {
      const newMessage: Message = {
        id: id ?? `${Date.now()}-${Math.random()}`,
        text,
        isSelf,
        time: time ?? formatMessageTime(),
        status: isSelf ? status ?? 'sent' : undefined,
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    []
  );

  const patchMessageById = useCallback(
    (id: string, patch: Partial<Pick<Message, 'id' | 'status' | 'time'>>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const markMessagesRead = useCallback((messageIds: string[]) => {
    if (messageIds.length === 0) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.isSelf && messageIds.includes(m.id) ? { ...m, status: 'read' } : m
      )
    );
  }, []);

  const resetChat = useCallback(() => {
    resetCallState();
    setPeer(null);
    sessionIdRef.current = null;
    setSessionId(null);
    setMessages([]);
    setIsTyping(false);
  }, [resetCallState]);

  const beginSearch = useCallback(() => {
    const sock = getChatSocket();
    if (!sock?.connected) return;
    resetChat();
    setStatus('searching');
    startMatchmaking(sock);
  }, [resetChat]);

  const scrollToEnd = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  const scrollToEndSmooth = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollToEnd(true);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollToEnd(true);
      scrollTimeoutRef.current = null;
    }, SCROLL_AFTER_KEYBOARD_MS);
  }, [scrollToEnd]);

  const dismissKeyboard = useCallback(() => {
    textInputRef.current?.blur();
    setInputFocused(false);
    Keyboard.dismiss();
  }, []);

  const onKeyboardHeightChange = useCallback((height: number) => {
    setKeyboardHeight(height);
  }, []);

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        runOnJS(onKeyboardHeightChange)(e.height);
      },
      onEnd: (e) => {
        'worklet';
        runOnJS(onKeyboardHeightChange)(e.height);
        runOnJS(scrollToEndSmooth)();
      },
    },
    [onKeyboardHeightChange, scrollToEndSmooth]
  );

  useEffect(() => {
    if (messages.length === 0) return;
    scrollToEndSmooth();
  }, [messages.length, scrollToEndSmooth]);

  useEffect(() => {
    if (!inputFocused) return;
    scrollToEndSmooth();
  }, [inputFocused, inputDockHeight, scrollToEndSmooth]);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    if (callIntent || status !== 'chat' || !peer) {
      setShowEncryptionNotice(false);
      return;
    }
    setShowEncryptionNotice(true);
    const timer = setTimeout(() => setShowEncryptionNotice(false), ENCRYPTION_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [callIntent, peer?.id, sessionId, status]);

  const attachChatHandlers = useCallback(
    (sock: Socket) => {
      sock.off('match:searching');
      sock.off('match:found');
      sock.off('message:receive');
      sock.off('message:rejected');
      sock.off('message:delivered');
      sock.off('message:seen');
      sock.off('peer:typing');
      sock.off('peer:disconnected');
      sock.off('webrtc:offer');
      sock.off('webrtc:answer');
      sock.off('webrtc:ice-candidate');
      sock.off('video:call-incoming');
      sock.off('video:call-accepted');
      sock.off('video:call-rejected');
      sock.off('video:call-ended');
      sock.off('video:call-busy');

      sock.on('match:searching', () => {
        setStatus('searching');
        resetChat();
      });

      sock.on('match:found', (data: { sessionId: string; peer: ChatPeer }) => {
        sessionIdRef.current = data.sessionId;
        setSessionId(data.sessionId);
        setPeer(data.peer);
        setStatus('chat');
        setMessages([]);
      });

      sock.on(
        'message:receive',
        (payload: {
          id: string;
          text: string;
          senderId: string;
          timestamp?: string;
        }) => {
          if (payload.senderId === myUserIdRef.current) return;
          const incoming = validateChatMessage(payload.text);
          if (!incoming.valid) return;
          const time = payload.timestamp
            ? formatMessageTime(new Date(payload.timestamp))
            : formatMessageTime();
          appendMessage(payload.text, false, payload.id, time);
          setIsTyping(false);
          const sid = sessionIdRef.current;
          if (sid) emitMessageSeen(sock, sid, [payload.id]);
        }
      );

      sock.on(
        'message:rejected',
        (payload: { clientId?: string | null; reason?: string; message?: string }) => {
          if (payload.clientId) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.clientId));
          }
          Alert.alert('Message not sent', payload.message || 'This message is not allowed.');
        }
      );

      sock.on(
        'message:delivered',
        (payload: { id: string; clientId?: string | null; timestamp?: string }) => {
          const localId = payload.clientId;
          if (localId) {
            patchMessageById(localId, {
              id: payload.id,
              status: 'delivered',
              time: payload.timestamp
                ? formatMessageTime(new Date(payload.timestamp))
                : undefined,
            });
          } else {
            patchMessageById(payload.id, { status: 'delivered' });
          }
        }
      );

      sock.on('message:seen', (payload: { messageIds: string[] }) => {
        markMessagesRead(payload.messageIds ?? []);
      });

      sock.on('peer:typing', ({ isTyping: typing }: { isTyping: boolean }) => {
        setIsTyping(typing);
      });

      sock.on('webrtc:offer', ({ offer, mode }: { offer: unknown; mode?: CallMode }) => {
        if (callPhaseRef.current !== 'accepted') return;
        const incomingMode: CallMode = mode === 'voice' ? 'voice' : 'video';
        setCallMode(incomingMode);
        setIsVideoCallActive(true);
        void (async () => {
          const ok = await webrtcRef.current.handleReceiveOffer(
            offer as RTCSessionDescriptionInit,
            incomingMode
          );
          if (!ok) failCallNegotiation('Could not start the call. Please try again.');
        })();
      });

      sock.on('webrtc:answer', ({ answer }: { answer: unknown }) => {
        if (callPhaseRef.current !== 'accepted') return;
        void (async () => {
          const ok = await webrtcRef.current.handleReceiveAnswer(answer as RTCSessionDescriptionInit);
          if (!ok) failCallNegotiation('Could not connect to your partner.');
        })();
      });

      sock.on('webrtc:ice-candidate', ({ candidate }: { candidate: unknown }) => {
        if (callPhaseRef.current !== 'accepted') return;
        void webrtcRef.current.handleReceiveIceCandidate(candidate as RTCIceCandidateInit);
      });

      sock.on('video:call-incoming', ({ mode }: { mode?: CallMode }) => {
        if (callPhaseRef.current !== 'idle') return;
        const incomingMode: CallMode = mode === 'voice' ? 'voice' : 'video';
        callPhaseRef.current = 'ringing-in';
        setIncomingCall(incomingMode);
      });

      sock.on('video:call-accepted', ({ mode }: { mode?: CallMode }) => {
        const activeMode: CallMode = mode === 'voice' ? 'voice' : 'video';
        clearOutgoingCallTimeout();
        callPhaseRef.current = 'accepted';
        setOutgoingCallPending(false);
        setCallMode(activeMode);
        setIsVideoCallActive(true);
        void (async () => {
          const ok = await webrtcRef.current.startCall(activeMode);
          if (!ok) failCallNegotiation('Could not start the call. Please try again.');
        })();
      });

      sock.on('video:call-rejected', () => {
        resetCallState();
        if (callIntentRef.current) {
          Alert.alert('Call declined', 'Your partner declined. You can call again or find another learner.');
          return;
        }
        Alert.alert('Call declined', 'Your partner declined the call.');
      });

      sock.on('video:call-ended', () => {
        resetCallState();
        if (callIntentRef.current) return;
        Alert.alert('Call ended', 'Your partner ended the call.');
      });

      sock.on('video:call-busy', () => {
        // Another learner already started the call (common when both used Call in English).
        resetCallState();
        if (callIntentRef.current) return;
        Alert.alert('Line busy', 'Your partner is already on a call.');
      });

      sock.on('peer:disconnected', () => {
        resetCallState();
        Alert.alert('Partner left', 'Your chat partner disconnected. Finding someone new...');
        beginSearch();
      });
    },
    [
      appendMessage,
      beginSearch,
      clearOutgoingCallTimeout,
      failCallNegotiation,
      markMessagesRead,
      patchMessageById,
      resetChat,
      resetCallState,
    ]
  );

  const declineIncomingCall = useCallback(() => {
    const sock = getChatSocket();
    const sid = sessionIdRef.current;
    if (sock && sid) rejectVideoCall(sock, sid);
    resetCallState();
  }, [resetCallState]);

  const acceptIncomingCall = useCallback(async () => {
    const mode = incomingCall;
    const sock = getChatSocket();
    const sid = sessionIdRef.current;
    if (!mode || !sock || !sid) return;

    if (!isWebRTCAvailable()) {
      Alert.alert('Rebuild required for calls', WEBRTC_REBUILD_HINT);
      declineIncomingCall();
      return;
    }

    const granted = await requestCallPermissions(mode);
    if (!granted) {
      declineIncomingCall();
      return;
    }

    const mediaOk = await webrtcRef.current.prepareLocalMedia(mode);
    if (!mediaOk) {
      declineIncomingCall();
      Alert.alert('Call failed', 'Could not access your microphone or camera.');
      return;
    }

    callPhaseRef.current = 'accepted';
    setIncomingCall(null);
    setCallMode(mode);
    setIsVideoCallActive(true);
    acceptVideoCall(sock, sid, mode);
  }, [incomingCall, declineIncomingCall]);

  const initiateCall = useCallback(
    async (mode: CallMode) => {
      if (!isWebRTCAvailable()) {
        Alert.alert('Rebuild required for calls', WEBRTC_REBUILD_HINT);
        return;
      }

      const sock = getChatSocket();
      const sid = sessionIdRef.current;
      if (!sock || !sid || outgoingCallPending || isVideoCallActive || incomingCall) return;
      if (callPhaseRef.current !== 'idle') return;

      const granted = await requestCallPermissions(mode);
      if (!granted) return;

      callPhaseRef.current = 'ringing-out';
      setCallMode(mode);
      setOutgoingCallPending(true);
      await webrtcRef.current.prepareLocalMedia(mode);
      startVideoCall(sock, sid, mode);

      clearOutgoingCallTimeout();
      outgoingCallTimeoutRef.current = setTimeout(() => {
        outgoingCallTimeoutRef.current = null;
        if (callPhaseRef.current !== 'ringing-out') return;
        const s = getChatSocket();
        const session = sessionIdRef.current;
        if (s && session) endVideoCall(s, session);
        resetCallState();
        Alert.alert('No answer', 'Your partner did not answer the call.');
      }, OUTGOING_CALL_TIMEOUT_MS);
    },
    [outgoingCallPending, isVideoCallActive, incomingCall, clearOutgoingCallTimeout, resetCallState]
  );

  // Call in English: after matching, start a voice call automatically (same conversation screen).
  useEffect(() => {
    if (!callIntent) return;
    if (status !== 'chat' || !peer?.id || !sessionId || !myUserId) return;
    if (autoCallStartedForSessionRef.current === sessionId) return;
    if (outgoingCallPending || isVideoCallActive || incomingCall) return;
    if (callPhaseRef.current !== 'idle') return;

    autoCallStartedForSessionRef.current = sessionId;

    // Stagger so two Call-in-English users don't dial each other at the same instant.
    const delayMs = String(myUserId) <= String(peer.id) ? 700 : 1600;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      if (callPhaseRef.current !== 'idle') return;
      if (incomingCall || isVideoCallActive || outgoingCallPending) return;
      void initiateCall('voice');
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    callIntent,
    status,
    peer?.id,
    sessionId,
    myUserId,
    outgoingCallPending,
    isVideoCallActive,
    incomingCall,
    initiateCall,
  ]);

  useEffect(() => {
    if (status === 'searching') {
      autoCallStartedForSessionRef.current = null;
    }
  }, [status]);

  const connectAndStartChat = useCallback(async (opts?: { forceReconnect?: boolean }) => {
    try {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }

      setStatus('connecting');
      setErrorMsg('');

      // Always attempt to proceed — ensureValidSession refreshes tokens silently.
      // Never gate on isLoggedInLocally here; only explicit logout should require re-sign-in.
      await ensureValidSession();

      const uid = await AsyncStorage.getItem(AUTH_KEYS.userId);
      if (uid) {
        myUserIdRef.current = uid;
        setMyUserId(uid);
      }

      // Only tear down an existing socket when retrying — avoids canceling matchmaking
      // on React Strict Mode remount / dependency churn.
      let sock = getChatSocket();
      if (opts?.forceReconnect || (sock && !sock.connected)) {
        disconnectChatSocket();
        sock = null;
      }
      if (!sock?.connected) {
        sock = await connectChatSocket();
      }
      if (!mountedRef.current) return;

      attachChatHandlersRef.current(sock);
      setStatus('searching');
      startMatchmaking(sock);
    } catch (e) {
      if (!mountedRef.current) return;
      setErrorMsg(e instanceof Error ? e.message : 'Could not connect to chat server.');
      setStatus('error');
    }
  }, []);

  // Keep latest handlers without re-running the mount connection effect.
  useEffect(() => {
    attachChatHandlersRef.current = attachChatHandlers;
  }, [attachChatHandlers]);

  useEffect(() => {
    mountedRef.current = true;
    void connectAndStartChat();

    return () => {
      mountedRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      clearOutgoingCallTimeout();
      resetCallState();

      // Defer disconnect so React Strict Mode remount can reuse the same socket
      // instead of cancel → reconnect loops that break matchmaking.
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) {
          disconnectChatSocket();
        }
        disconnectTimerRef.current = null;
      }, 450);
    };
    // Mount once — reconnect via retryChatConnection / beginSearch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryChatConnection = useCallback(() => {
    mountedRef.current = true;
    void connectAndStartChat({ forceReconnect: true });
  }, [connectAndStartChat]);
  const handleSend = () => {
    const text = inputText.trim();
    const sock = getChatSocket();
    if (!text || !sock || !sessionId) return;

    const validation = validateChatMessage(text);
    if (!validation.valid) {
      Alert.alert('Message not sent', validation.message);
      return;
    }

    const clientId = `c-${Date.now()}`;
    appendMessage(text, true, clientId, undefined, 'sent');
    sendChatMessage(sock, sessionId, text, clientId);
    setInputText('');
    emitTypingStop(sock, sessionId);
    scrollToEndSmooth();
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    const sock = getChatSocket();
    if (!sock || !sessionId) return;

    if (text.length > 0) {
      emitTypingStart(sock, sessionId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop(sock, sessionId);
      }, 2000);
    } else {
      emitTypingStop(sock, sessionId);
    }
  };

  const handleSkip = () => {
    const sock = getChatSocket();
    if (isVideoCallActive || outgoingCallPending) {
      const sid = sessionIdRef.current;
      if (sock && sid) endVideoCall(sock, sid);
      resetCallState();
    }
    if (!sock || !sessionId) {
      beginSearch();
      return;
    }
    skipChatPartner(sock, sessionId);
    setStatus('searching');
    resetChat();
  };

  const openReportEmail = useCallback(() => {
    const partnerName = peer?.name ?? 'learner';
    void Linking.openURL(
      `mailto:${APP_INFO.email}?subject=${encodeURIComponent(`${APP_INFO.appName} — Random chat report`)}&body=${encodeURIComponent(`Partner: ${partnerName}\n\nDescribe what happened:\n`)}`
    );
  }, [peer?.name]);

  const handleReport = () => {
    openReportEmail();
  };

  const closeChatOptions = useCallback(() => {
    setShowChatOptions(false);
  }, []);

  const handleChatOptionSkip = useCallback(() => {
    closeChatOptions();
    handleSkip();
  }, [closeChatOptions, handleSkip]);

  const handleChatOptionReport = useCallback(() => {
    closeChatOptions();
    openReportEmail();
  }, [closeChatOptions, openReportEmail]);

  const handleBack = () => {
    const sock = getChatSocket();
    const sid = sessionIdRef.current;
    if ((isVideoCallActive || outgoingCallPending) && sock && sid) {
      endVideoCall(sock, sid);
      resetCallState();
    }
    if (sock) cancelMatchmaking(sock);
    disconnectChatSocket();
    router.back();
  };

  const renderMessageStatus = (status: MessageStatus | undefined) => {
    const color = status === 'read' ? TICK_COLOR_READ : TICK_COLOR;
    if (status === 'read' || status === 'delivered') {
      return <Ionicons name="checkmark-done" size={15} color={color} />;
    }
    return <Ionicons name="checkmark" size={15} color={color} />;
  };

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <Pressable
        onPress={dismissKeyboard}
        style={[styles.messageRow, item.isSelf && styles.messageRowSelf]}
      >
        <View style={[styles.messageBubble, item.isSelf ? styles.messageBubbleSelf : styles.messageBubblePeer]}>
          <View style={styles.messageBody}>
            <Text
              style={[
                styles.messageText,
                item.isSelf ? styles.messageTextSelf : styles.messageTextPeer,
              ]}
            >
              {item.text}
            </Text>
            {item.isSelf ? (
              <View style={styles.messageTicks}>{renderMessageStatus(item.status)}</View>
            ) : null}
          </View>
        </View>
      </Pressable>
    ),
    [dismissKeyboard]
  );

  const trimmedInput = inputText.trim();
  const canSend = trimmedInput.length > 0 && !isChatMessageBlocked(trimmedInput);

  const renderChatInputBar = () => (
    <View style={styles.inputDockInner}>
      <View style={styles.inputRow}>
        <View style={styles.inputPill}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder="Type in English only…"
            placeholderTextColor={UI.textTertiary}
            value={inputText}
            onChangeText={handleInputChange}
            onFocus={() => {
              setInputFocused(true);
              scrollToEndSmooth();
            }}
            onBlur={() => setInputFocused(false)}
            multiline
            maxLength={500}
            blurOnSubmit={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.88}
        >
          <Feather name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const bottomInset =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_NAV_BAR_HEIGHT)
      : Math.max(insets.bottom, 8);
  const effectiveKeyboardHeight =
    keyboardHeight > 0
      ? keyboardHeight
      : inputFocused && Platform.OS === 'android'
        ? ANDROID_KEYBOARD_FALLBACK
        : 0;

  const composerInset =
    inputDockHeight + effectiveKeyboardHeight + EXTRA_LIST_SPACING + (isTyping ? 32 : 0);

  const listFooter = (
    <>
      {isTyping ? <ChatTypingBubble /> : null}
      <View style={{ height: composerInset }} />
    </>
  );

  const navBarTopPadding = getNavBarTopPadding(insets);

  const renderWaHeaderShell = (content: React.ReactNode) => (
    <View style={[styles.waHeaderShell, { paddingTop: navBarTopPadding }]}>{content}</View>
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const useWaChrome =
      status === 'chat' || status === 'connecting' || status === 'searching';
    void SystemUI.setBackgroundColorAsync(useWaChrome ? WA.header : UI.bg);
    return () => {
      void SystemUI.setBackgroundColorAsync(UI.bg);
    };
  }, [status]);

  const showChatHeaderMenu = useCallback(() => {
    setShowChatOptions(true);
  }, []);

  const renderNavHeader = (
    title: string,
    subtitle: string,
    options?: {
      peer?: ChatPeer;
      onSkip?: () => void;
      onReport?: () => void;
      onVideoCall?: () => void;
      onVoiceCall?: () => void;
      subtitleAccent?: boolean;
      hideIcon?: boolean;
      backOnly?: boolean;
      whatsapp?: boolean;
    }
  ) => {
    const isWaChat = options?.whatsapp && options?.peer;

    if (options?.backOnly) {
      return renderWaHeaderShell(
        <View style={styles.waNavBarRow}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.waIconBtn, pressed && styles.waIconBtnPressed]}
            hitSlop={12}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={WA.icon} />
          </Pressable>

          {title ? (
            <Text style={styles.waHeaderCenterTitle} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={styles.waHeaderTitleSpacer} />
          )}

          <View style={styles.waHeaderSideSpacer} />
        </View>
      );
    }

    if (isWaChat && options.peer) {
      const peer = options.peer;
      const callEnabled = isWebRTCAvailable();
      const subtitleText = isTyping
        ? 'typing…'
        : outgoingCallPending
          ? 'Calling…'
          : subtitle || 'online';

      return renderWaHeaderShell(
        <View style={styles.waNavBarRow}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.waIconBtn, pressed && styles.waIconBtnPressed]}
            hitSlop={12}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={WA.icon} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.waProfileTap, pressed && styles.waIconBtnPressed]}
            accessibilityLabel={`${peer.name} profile`}
          >
            <View style={styles.waAvatarWrap}>
              <PeerAvatar peer={peer} size={40} />
              <View style={styles.waOnlineBadge} />
            </View>
            <View style={styles.waProfileText}>
              <Text style={styles.waTitle} numberOfLines={1}>
                {peer.name}
              </Text>
              <Text
                style={[
                  styles.waSubtitle,
                  (options.subtitleAccent || isTyping) && styles.waSubtitleAccent,
                ]}
                numberOfLines={1}
              >
                {subtitleText}
              </Text>
            </View>
          </Pressable>

          <View style={styles.waActions}>
            {options.onVideoCall ? (
              <Pressable
                onPress={options.onVideoCall}
                style={({ pressed }) => [
                  styles.waIconBtn,
                  !callEnabled && styles.waIconBtnDisabled,
                  pressed && styles.waIconBtnPressed,
                ]}
                hitSlop={8}
                accessibilityLabel="Start video call"
              >
                <Ionicons name="videocam" size={24} color={WA.icon} />
              </Pressable>
            ) : null}

            {options.onVoiceCall ? (
              <Pressable
                onPress={options.onVoiceCall}
                style={({ pressed }) => [
                  styles.waIconBtn,
                  !callEnabled && styles.waIconBtnDisabled,
                  pressed && styles.waIconBtnPressed,
                ]}
                hitSlop={8}
                accessibilityLabel="Start voice call"
              >
                <Ionicons name="call" size={22} color={WA.icon} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={showChatHeaderMenu}
              style={({ pressed }) => [styles.waIconBtn, pressed && styles.waIconBtnPressed]}
              hitSlop={8}
              accessibilityLabel="More options"
            >
              <Feather name="more-vertical" size={22} color={WA.icon} />
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.navBar, { paddingTop: navBarTopPadding }]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          hitSlop={12}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={24} color={UI.text} />
        </Pressable>

        {options?.peer ? (
          <View style={styles.headerAvatarWrap}>
            <PeerAvatar peer={options.peer} size={44} />
            <View style={styles.onlineBadge} />
          </View>
        ) : options?.hideIcon ? null : (
          <View style={styles.headerIconBadge}>
            <Ionicons name="chatbubbles" size={20} color="#fff" />
          </View>
        )}

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.headerSubtitle, options?.subtitleAccent && styles.headerSubtitleAccent]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {options?.onReport ? (
          <Pressable
            onPress={options.onReport}
            style={({ pressed }) => [styles.reportBtn, pressed && styles.backBtnPressed]}
            hitSlop={8}
            accessibilityLabel="Report user"
          >
            <Feather name="flag" size={18} color={UI.textSecondary} />
          </Pressable>
        ) : null}

        {options?.onVoiceCall ? (
          <Pressable
            onPress={options.onVoiceCall}
            style={({ pressed }) => [
              styles.videoCallBtn,
              !isWebRTCAvailable() && styles.videoCallBtnDisabled,
              pressed && styles.backBtnPressed,
            ]}
            hitSlop={8}
            accessibilityLabel="Start voice call"
          >
            <Feather
              name="phone"
              size={18}
              color={isWebRTCAvailable() ? UI.accent : UI.textSecondary}
            />
          </Pressable>
        ) : null}

        {options?.onVideoCall ? (
          <Pressable
            onPress={options.onVideoCall}
            style={({ pressed }) => [
              styles.videoCallBtn,
              !isWebRTCAvailable() && styles.videoCallBtnDisabled,
              pressed && styles.backBtnPressed,
            ]}
            hitSlop={8}
            accessibilityLabel="Start video call"
          >
            <Feather
              name="video"
              size={18}
              color={isWebRTCAvailable() ? UI.accent : UI.textSecondary}
            />
          </Pressable>
        ) : null}

        {options?.onSkip ? (
          <Pressable
            onPress={options.onSkip}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.backBtnPressed]}
            hitSlop={8}
            accessibilityLabel="Find another partner"
          >
            <Feather name="refresh-cw" size={18} color={UI.accent} />
          </Pressable>
        ) : (
          <View style={styles.headerActionSpacer} />
        )}
      </View>
    );
  };

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar
          barStyle="dark-content"
          backgroundColor={AppUI.bg}
          translucent={Platform.OS === 'android'}
        />
        {renderNavHeader(
          callIntent ? 'Call in English' : 'Chat in English',
          'Connection issue'
        )}
        <View style={styles.centeredBody}>
          <Feather name="wifi-off" size={48} color="#e60000" />
          <Text style={styles.centeredTitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retryChatConnection}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'connecting' || status === 'searching') {
    const headerTitle =
      status === 'connecting'
        ? 'Connecting…'
        : callIntent
          ? 'Finding a speaking partner'
          : 'Finding learner';

    return (
      <View style={styles.waChatContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar
          barStyle="light-content"
          backgroundColor={WA.header}
          translucent={Platform.OS === 'android'}
        />
        {renderNavHeader(headerTitle, '', { backOnly: true })}
        <View style={styles.matchmakingBody}>
          <MatchmakingScene />
          {callIntent ? (
            <Text style={styles.callIntentHint}>
              Connecting you with a random learner for an English voice call
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (!peer) return null;

  const renderCallControls = () => (
    <View
      style={[
        styles.videoControls,
        { paddingBottom: Math.max(insets.bottom, 16) + 8 },
      ]}
    >
      <TouchableOpacity
        style={[styles.controlBtn, isMicMuted && styles.controlBtnMuted]}
        onPress={() => {
          const newMute = !isMicMuted;
          setIsMicMuted(newMute);
          toggleMic(newMute);
        }}
        accessibilityLabel={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <Feather name={isMicMuted ? 'mic-off' : 'mic'} size={22} color="white" />
      </TouchableOpacity>

      {callMode === 'video' ? (
        <TouchableOpacity
          style={[styles.controlBtn, isCameraOff && styles.controlBtnMuted]}
          onPress={() => {
            const next = !isCameraOff;
            setIsCameraOff(next);
            toggleCamera(next);
          }}
          accessibilityLabel={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <Feather name={isCameraOff ? 'video-off' : 'video'} size={22} color="white" />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.controlBtn, styles.controlBtnEnd]}
        onPress={endCallAndReturnToChat}
        accessibilityLabel="End call"
      >
        <Feather name="phone-off" size={22} color="white" />
      </TouchableOpacity>

      {outgoingCallPending ? (
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={endCallAndReturnToChat}
          accessibilityLabel="Cancel call"
        >
          <Feather name="x" size={22} color="white" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderActiveCallStage = () => (
    <>
      <View style={[styles.callTopBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.callTopInfo}>
          <PeerAvatar peer={peer} size={40} />
          <View style={styles.callTopText}>
            <Text style={styles.callPeerName} numberOfLines={1}>
              {peer.name}
            </Text>
            <Text style={styles.callStatusText}>
              {outgoingCallPending
                ? 'Calling…'
                : callMode === 'voice'
                  ? 'Voice call'
                  : remoteStream
                    ? 'Video call'
                    : 'Connecting…'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.callStage}>
        {outgoingCallPending ? (
          <View style={styles.callPlaceholder}>
            <PeerAvatar peer={peer} size={96} />
            <Text style={styles.callingText}>Calling {peer.name}…</Text>
            <Text style={styles.callHintText}>
              {callIntent
                ? 'Practice speaking English when they answer'
                : 'Stay on this chat — the conversation will return when you end the call'}
            </Text>
          </View>
        ) : callMode === 'voice' ? (
          <View style={styles.voiceCallBody}>
            <PeerAvatar peer={peer} size={96} />
            <Text style={styles.voiceCallTitle}>Voice practice</Text>
            <Text style={styles.voiceCallSubtitle}>{peer.name}</Text>
          </View>
        ) : remoteStream ? (
          <WebRTCVideo
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.callPlaceholder}>
            <PeerAvatar peer={peer} size={96} />
            <Text style={styles.callingText}>Connecting to {peer.name}…</Text>
          </View>
        )}

        {callMode === 'video' && localStream ? (
          <WebRTCVideo
            streamURL={localStream.toURL()}
            style={[styles.localVideo, { bottom: 110 + Math.max(insets.bottom, 8) }]}
            objectFit="cover"
            mirror
          />
        ) : null}
      </View>

      {renderCallControls()}
    </>
  );

  const renderIncomingCallModal = () => (
    <Modal
      visible={incomingCall !== null}
      transparent
      animationType="fade"
      onRequestClose={declineIncomingCall}
    >
      <Pressable style={styles.chatOptionsBackdrop} onPress={declineIncomingCall}>
        <View style={styles.incomingCallCard} onStartShouldSetResponder={() => true}>
          <View style={styles.incomingCallIconWrap}>
            <Ionicons
              name={incomingCall === 'voice' ? 'call' : 'videocam'}
              size={28}
              color={WA.header}
            />
          </View>
          <Text style={styles.incomingCallTitle}>
            Incoming {incomingCall === 'voice' ? 'voice' : 'video'} call
          </Text>
          <Text style={styles.incomingCallSubtitle}>
            {callIntent
              ? `${peer.name} wants a voice call to practice English with you.`
              : `${peer.name} wants to practice English with you.`}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.incomingCallAcceptBtn,
              pressed && styles.chatOptionsBtnPressed,
            ]}
            onPress={() => void acceptIncomingCall()}
          >
            <Text style={styles.incomingCallAcceptText}>Accept</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.chatOptionsBtn,
              styles.chatOptionsBtnLast,
              pressed && styles.chatOptionsBtnPressed,
            ]}
            onPress={declineIncomingCall}
          >
            <Text style={styles.chatOptionsBtnTextDanger}>Decline</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  // ── Call in English: call-only UI (no chat) ───────────────────────────────
  if (callIntent) {
    return (
      <View style={styles.waChatContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
          translucent={Platform.OS === 'android'}
        />

        <View style={styles.callOnlyScreen}>
          {isInCallUi ? (
            renderActiveCallStage()
          ) : (
            <>
              <View style={[styles.callOnlyHeader, { paddingTop: Math.max(insets.top, 12) }]}>
                <Pressable
                  onPress={handleBack}
                  style={({ pressed }) => [styles.waIconBtn, pressed && styles.waIconBtnPressed]}
                  hitSlop={12}
                  accessibilityLabel="Go back"
                >
                  <Feather name="arrow-left" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.callOnlyHeaderTitle}>Call in English</Text>
                <View style={styles.waHeaderSideSpacer} />
              </View>

              <View style={styles.callOnlyLobby}>
                <PeerAvatar peer={peer} size={110} />
                <Text style={styles.callOnlyPeerName}>{peer.name}</Text>
                <Text style={styles.callOnlyStatus}>
                  {incomingCall
                    ? 'Incoming call…'
                    : 'Connected — tap Call to practice speaking English'}
                </Text>

                <TouchableOpacity
                  style={styles.callOnlyPrimaryBtn}
                  onPress={() => void initiateCall('voice')}
                  activeOpacity={0.88}
                  disabled={!!incomingCall}
                >
                  <Ionicons name="call" size={22} color="#fff" />
                  <Text style={styles.callOnlyPrimaryBtnText}>Start voice call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.callOnlySecondaryBtn}
                  onPress={handleSkip}
                  activeOpacity={0.88}
                >
                  <Feather name="refresh-cw" size={18} color="#fff" />
                  <Text style={styles.callOnlySecondaryBtnText}>Find another learner</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {renderIncomingCallModal()}
      </View>
    );
  }

  return (
    <View style={styles.waChatContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="light-content"
        backgroundColor={isInCallUi ? '#000000' : WA.header}
        translucent={Platform.OS === 'android'}
      />

      {/* Chat stays mounted under the call so ending a call restores it instantly */}
      <View
        style={[styles.chatLayer, isInCallUi && styles.chatLayerHidden]}
        pointerEvents={isInCallUi ? 'none' : 'auto'}
      >
        {renderNavHeader(
          peer.name,
          'tap here for learner info',
          {
            peer,
            whatsapp: true,
            onVoiceCall: () => void initiateCall('voice'),
            onVideoCall: () => void initiateCall('video'),
            onSkip: handleSkip,
            onReport: handleReport,
            subtitleAccent: isTyping || outgoingCallPending,
          }
        )}

        {showEncryptionNotice ? (
          <Pressable onPress={dismissKeyboard} style={styles.encryptionBanner}>
            <Feather name="lock" size={12} color={UI.accent} />
            <Text style={styles.encryptionText} numberOfLines={1} ellipsizeMode="tail">
              Messages are private between you and {peer.name}.
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.chatKeyboardRoot}>
          <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
            <View style={styles.messagesArea}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.messageList}
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                decelerationRate="normal"
                scrollEventThrottle={16}
                overScrollMode="never"
                removeClippedSubviews={Platform.OS === 'android'}
                ListEmptyComponent={
                  <Pressable onPress={dismissKeyboard} style={styles.emptyChatPress}>
                    <Text style={styles.emptyChat}>Say hello to {peer.name}!</Text>
                  </Pressable>
                }
                ListFooterComponent={listFooter}
              />
            </View>
          </TouchableWithoutFeedback>

          <KeyboardStickyView
            offset={{ closed: 0, opened: 0 }}
            style={styles.inputStickyWrap}
          >
            <View
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                if (h > 0 && h !== inputDockHeight) setInputDockHeight(h);
              }}
              style={[
                styles.inputFooter,
                { paddingBottom: keyboardHeight > 0 ? 6 : bottomInset },
              ]}
            >
              {renderChatInputBar()}
            </View>
          </KeyboardStickyView>
        </View>
      </View>

      {/* Full-screen call — covers chat in-place (WhatsApp-style) */}
      {isInCallUi ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          style={styles.callFullscreen}
        >
          {renderActiveCallStage()}
        </Animated.View>
      ) : null}

      {renderIncomingCallModal()}

      <Modal
        visible={showChatOptions}
        transparent
        animationType="fade"
        onRequestClose={closeChatOptions}
      >
        <Pressable style={styles.chatOptionsBackdrop} onPress={closeChatOptions}>
          <View style={styles.chatOptionsCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.chatOptionsTitle}>Chat options</Text>

            <Pressable
              style={({ pressed }) => [
                styles.chatOptionsBtn,
                pressed && styles.chatOptionsBtnPressed,
              ]}
              onPress={handleChatOptionSkip}
            >
              <Text style={styles.chatOptionsBtnText}>Find another partner</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.chatOptionsBtn,
                pressed && styles.chatOptionsBtnPressed,
              ]}
              onPress={handleChatOptionReport}
            >
              <Text style={styles.chatOptionsBtnTextDanger}>Report user</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.chatOptionsBtn,
                styles.chatOptionsBtnLast,
                pressed && styles.chatOptionsBtnPressed,
              ]}
              onPress={closeChatOptions}
            >
              <Text style={styles.chatOptionsBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },
  waChatContainer: {
    flex: 1,
    backgroundColor: WA.chatBg,
  },
  waHeaderShell: {
    backgroundColor: WA.header,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  waNavBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: Platform.OS === 'android' ? 10 : 12,
    minHeight: 56,
  },
  waHeaderCenterTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: WA.icon,
    letterSpacing: -0.2,
  },
  waHeaderTitleSpacer: {
    flex: 1,
  },
  waHeaderSideSpacer: {
    width: 44,
    height: 44,
  },
  waIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  waIconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  waIconBtnDisabled: {
    opacity: 0.45,
  },
  waProfileTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingVertical: 4,
    paddingRight: 8,
    borderRadius: 8,
  },
  waAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  waOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: WA.typing,
    borderWidth: 2,
    borderColor: WA.header,
  },
  waProfileText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  waTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: WA.icon,
    letterSpacing: -0.2,
  },
  waSubtitle: {
    fontSize: 13,
    color: WA.subtitle,
    marginTop: 1,
    fontWeight: '400',
  },
  waSubtitleAccent: {
    color: WA.typing,
    fontWeight: '500',
  },
  waActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  chatKeyboardRoot: { flex: 1, flexDirection: 'column' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'android' ? 8 : 12,
    gap: 12,
    backgroundColor: UI.bg,
  },
  navBarBackOnly: {
    paddingBottom: Platform.OS === 'android' ? 4 : 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
    ...cardShadow,
  },
  backBtnPressed: { opacity: 0.85 },
  skipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
    ...cardShadow,
  },
  reportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
    marginRight: 8,
    ...cardShadow,
  },
  videoCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
    marginRight: 8,
    ...cardShadow,
  },
  videoCallBtnDisabled: {
    opacity: 0.55,
  },
  headerActionSpacer: { width: 40 },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarWrap: { position: 'relative' },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: UI.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerSubtitleAccent: {
    color: '#12B76A',
    fontWeight: '600',
  },
  matchmakingBody: {
    flex: 1,
    backgroundColor: WA.chatBg,
  },
  callIntentHint: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 36,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: UI.textSecondary,
    fontWeight: '500',
  },
  centeredBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: UI.bg,
  },
  centeredTitle: {
    fontSize: 16,
    color: UI.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: UI.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    ...cardShadow,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryRetryBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  secondaryRetryBtnText: {
    color: UI.accent,
    fontWeight: '600',
    fontSize: 15,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#12B76A',
    borderWidth: 2,
    borderColor: UI.surface,
  },
  encryptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  encryptionText: {
    fontSize: 11,
    lineHeight: 14,
    color: UI.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  chatOptionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  chatOptionsCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#F3F3F3',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 14,
  },
  chatOptionsTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: UI.text,
    marginBottom: 14,
  },
  chatOptionsBtn: {
    backgroundColor: '#E4E4E4',
    borderRadius: 22,
    paddingVertical: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatOptionsBtnLast: {
    marginBottom: 0,
  },
  chatOptionsBtnPressed: {
    opacity: 0.82,
  },
  chatOptionsBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: UI.text,
  },
  chatOptionsBtnTextDanger: {
    fontSize: 15,
    fontWeight: '500',
    color: UI.accent,
  },
  incomingCallCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#F3F3F3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 14,
    alignItems: 'center',
  },
  incomingCallIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  incomingCallTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  incomingCallSubtitle: {
    fontSize: 13,
    color: UI.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  incomingCallAcceptBtn: {
    alignSelf: 'stretch',
    backgroundColor: WA.header,
    borderRadius: 22,
    paddingVertical: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  incomingCallAcceptText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messagesArea: {
    flex: 1,
    backgroundColor: WA.chatBg,
  },
  messageList: { flex: 1 },
  inputStickyWrap: {
    width: '100%',
    flexShrink: 0,
    zIndex: 20,
  },
  inputFooter: {
    minHeight: DEFAULT_INPUT_DOCK_HEIGHT,
    backgroundColor: UI.surface,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  emptyChatPress: {
    flexGrow: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyChat: {
    color: UI.textTertiary,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  chatLayer: {
    flex: 1,
  },
  chatLayerHidden: {
    opacity: 0,
  },
  callFullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 40,
    elevation: 40,
  },
  callOnlyScreen: {
    flex: 1,
    backgroundColor: '#0B141A',
  },
  callOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  callOnlyHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  callOnlyLobby: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
    paddingBottom: 40,
  },
  callOnlyPeerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  callOnlyStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  callOnlyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#25D366',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 28,
    minWidth: 240,
  },
  callOnlyPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  callOnlySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    minWidth: 240,
  },
  callOnlySecondaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  callTopBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 2,
  },
  callTopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callTopText: {
    flex: 1,
    minWidth: 0,
  },
  callPeerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  callStatusText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  callStage: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  callPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  callHintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  localVideo: {
    position: 'absolute',
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    ...cardShadow,
  },
  callingText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  voiceCallBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  voiceCallTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  voiceCallSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnMuted: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  controlBtnEnd: {
    backgroundColor: '#ff3b30',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    maxWidth: '92%',
  },
  messageRowSelf: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  messageBubbleSelf: {
    backgroundColor: BUBBLE_SELF_BG,
    borderTopRightRadius: 6,
  },
  messageBubblePeer: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 6,
    ...cardShadow,
  },
  messageBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
    flexGrow: 1,
  },
  messageTextSelf: { color: '#fff' },
  messageTextPeer: { color: UI.text },
  messageTicks: {
    marginLeft: 2,
    marginBottom: 1,
  },
  inputDockInner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputPill: {
    flex: 1,
    backgroundColor: UI.surfaceMuted,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.divider,
    minHeight: 46,
    justifyContent: 'center',
    maxHeight: 120,
  },
  textInput: {
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    color: UI.text,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...cardShadow,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
