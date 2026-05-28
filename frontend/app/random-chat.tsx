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
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import { runOnJS } from 'react-native-reanimated';
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
  type ChatPeer,
} from '@/utils/chatSocket';
import { getAccessToken } from '@/utils/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import { MatchmakingScene } from '@/components/MatchmakingScene';
import { ChatTypingBubble } from '@/components/ChatTypingBubble';
import { AppUI, cardShadow } from '@/constants/theme';

type MessageStatus = 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  text: string;
  isSelf: boolean;
  time: string;
  status?: MessageStatus;
}

const BUBBLE_PEER_BG = '#d9f5d0';
const BUBBLE_SELF_BG = '#5b9bd5';
const TICK_COLOR = '#e60000';
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
function PeerAvatar({ peer }: { peer: ChatPeer }) {
  if (peer.avatar) {
    return <Image source={{ uri: peer.avatar }} style={styles.peerAvatar} />;
  }
  return (
    <View style={[styles.peerAvatar, styles.peerAvatarPlaceholder]}>
      <Ionicons name="person" size={22} color="#fff" />
    </View>
  );
}

export default function RandomChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'connecting' | 'searching' | 'chat' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [peer, setPeer] = useState<ChatPeer | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState('');
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
    setPeer(null);
    sessionIdRef.current = null;
    setSessionId(null);
    setMessages([]);
    setIsTyping(false);
  }, []);

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
    if (status !== 'chat' || !peer) {
      setShowEncryptionNotice(false);
      return;
    }
    setShowEncryptionNotice(true);
    const timer = setTimeout(() => setShowEncryptionNotice(false), ENCRYPTION_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [peer?.id, sessionId, status]);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (mounted) {
            setErrorMsg('Please sign in to chat with real learners.');
            setStatus('error');
          }
          return;
        }

        const uid = await AsyncStorage.getItem(AUTH_KEYS.userId);
        if (uid && mounted) setMyUserId(uid);

        const sock = await connectChatSocket();
        if (!mounted) return;

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
            const currentUid = uid ?? myUserId;
            if (payload.senderId === currentUid) return;
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

        sock.on('peer:disconnected', () => {
          Alert.alert('Partner left', 'Your chat partner disconnected. Finding someone new...');
          beginSearch();
        });

        setStatus('searching');
        startMatchmaking(sock);
      } catch (e) {
        if (mounted) {
          setErrorMsg(e instanceof Error ? e.message : 'Could not connect to chat server.');
          setStatus('error');
        }
      }
    };

    setup();

    return () => {
      mounted = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      disconnectChatSocket();
    };
  }, [appendMessage, beginSearch, markMessagesRead, patchMessageById, resetChat]);

  const handleSend = () => {
    const text = inputText.trim();
    const sock = getChatSocket();
    if (!text || !sock || !sessionId) return;

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
    if (!sock || !sessionId) {
      beginSearch();
      return;
    }
    skipChatPartner(sock, sessionId);
    setStatus('searching');
    resetChat();
  };

  const handleBack = () => {
    const sock = getChatSocket();
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
        style={[
          styles.messageWrapper,
          item.isSelf ? styles.messageWrapperSelf : styles.messageWrapperPeer,
        ]}
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

  const renderChatInputBar = () => (
    <View style={styles.inputDockInner}>
      <View style={styles.inputRow}>
        <View style={styles.inputPill}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder="Message"
            placeholderTextColor="#8696a0"
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

        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.85}>
          <Ionicons name="send" size={22} color="#fff" />
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

  const renderNavHeader = (
    title: string,
    subtitle: string,
    options?: { peer?: ChatPeer; onSkip?: () => void }
  ) => {
    const hasAvatar = !!options?.peer;
    const subMarginLeft = hasAvatar ? 102 : 52;

    return (
      <View style={[styles.lbHeader, { paddingTop: insets.top }]}>
        <View style={styles.lbHeaderRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.lbBackBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color="#101010" />
          </TouchableOpacity>

          {hasAvatar ? (
            <View style={styles.headerAvatarWrap}>
              <PeerAvatar peer={options.peer!} />
              <View style={styles.onlineBadge} />
            </View>
          ) : null}

          <Text style={styles.lbHeaderTitle} numberOfLines={1}>
            {title}
          </Text>

          {options?.onSkip ? (
            <TouchableOpacity
              onPress={options.onSkip}
              style={styles.lbBackBtn}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Find another partner"
            >
              <Ionicons name="play-skip-forward" size={20} color="#101010" />
            </TouchableOpacity>
          ) : (
            <View style={styles.lbHeaderSpacer} />
          )}
        </View>
        {subtitle ? (
          <Text
            style={[
              styles.lbHeaderSub,
              { marginLeft: subMarginLeft },
              isTyping && options?.peer && styles.headerSubTyping,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  };

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={AppUI.bg} />
        {renderNavHeader('Chat in English', 'Connection issue')}
        <View style={styles.centeredBody}>
          <Feather name="wifi-off" size={48} color="#e60000" />
          <Text style={styles.centeredTitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.retryBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'connecting' || status === 'searching') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={AppUI.bg} />
        {renderNavHeader(
          'Chat in English',
          status === 'connecting' ? 'Connecting to server…' : ''
        )}
        <MatchmakingScene />
      </View>
    );
  }

  if (!peer) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={AppUI.surface} />

      {renderNavHeader(peer.name, '', {
        peer,
        onSkip: handleSkip,
      })}

      {showEncryptionNotice ? (
        <Pressable onPress={dismissKeyboard} style={styles.encryptionBanner}>
          <Feather name="lock" size={13} color="#667781" />
          <Text style={styles.encryptionText}>
            Messages are end-to-end encrypted. Only you and {peer.name} can read them.
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppUI.bg },
  flex1: { flex: 1 },
  chatKeyboardRoot: { flex: 1, flexDirection: 'column' },
  lbHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: AppUI.bg,
  },
  lbHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  lbBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  lbHeaderTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#101010',
    letterSpacing: -0.4,
  },
  lbHeaderSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 20,
  },
  lbHeaderSpacer: {
    width: 40,
  },
  headerAvatarWrap: { position: 'relative' },
  headerSubTyping: { color: '#00b894', fontWeight: '600' },
  centeredBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centeredTitle: {
    fontSize: 16,
    color: AppUI.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: AppUI.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  peerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  peerAvatarPlaceholder: {
    backgroundColor: '#e60000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#00b894',
    borderWidth: 2,
    borderColor: '#fff',
  },
  encryptionBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efeae2',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 6,
  },
  encryptionText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    color: '#667781',
    maxWidth: 320,
  },
  messagesArea: {
    flex: 1,
    backgroundColor: '#efeae2',
  },
  messageList: { flex: 1 },
  inputStickyWrap: {
    width: '100%',
    flexShrink: 0,
    backgroundColor: '#f0f2f5',
    zIndex: 20,
    elevation: 24,
  },
  inputFooter: {
    minHeight: DEFAULT_INPUT_DOCK_HEIGHT,
    backgroundColor: '#f0f2f5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d7db',
    paddingTop: Platform.OS === 'android' ? 6 : 8,
    paddingHorizontal: Platform.OS === 'android' ? 8 : 6,
    justifyContent: 'center',
  },
  chatContent: {
    paddingHorizontal: 10,
    paddingTop: 12,
    flexGrow: 1,
  },
  emptyChatPress: {
    flexGrow: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyChat: { textAlign: 'center', color: '#667781', fontSize: 15 },
  messageWrapper: { marginBottom: 4, maxWidth: '82%' },
  messagePressed: { opacity: 0.92 },
  messageWrapperSelf: { alignSelf: 'flex-end' },
  messageWrapperPeer: { alignSelf: 'flex-start' },
  messageBubble: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 14,
    maxWidth: '100%',
  },
  messageBubbleSelf: {
    backgroundColor: BUBBLE_SELF_BG,
    borderTopRightRadius: 4,
  },
  messageBubblePeer: {
    backgroundColor: BUBBLE_PEER_BG,
    borderTopLeftRadius: 4,
  },
  messageBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 21,
    flexShrink: 1,
    flexGrow: 1,
  },
  messageTextSelf: { color: '#fff' },
  messageTextPeer: { color: '#1a1a1a' },
  messageTicks: {
    marginLeft: 2,
    marginBottom: 1,
  },
  inputDockInner: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Platform.OS === 'android' ? 8 : 6,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 4 : 6,
    minHeight: Platform.OS === 'android' ? 44 : 40,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e9edef',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: '#111b21',
    maxHeight: 100,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: Platform.OS === 'android' ? 8 : 4,
    paddingHorizontal: 0,
    minHeight: Platform.OS === 'android' ? 36 : 32,
  },
  sendBtn: {
    width: Platform.OS === 'android' ? 48 : 44,
    height: Platform.OS === 'android' ? 48 : 44,
    borderRadius: Platform.OS === 'android' ? 24 : 22,
    backgroundColor: '#e60000',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
