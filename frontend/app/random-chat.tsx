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
import type { Socket } from 'socket.io-client';
import { AUTH_KEYS, isLoggedInLocally } from '@/utils/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureValidSession } from '@/utils/api';
import { MatchmakingScene } from '@/components/MatchmakingScene';
import { ChatTypingBubble } from '@/components/ChatTypingBubble';
import { AppUI, cardShadow } from '@/constants/theme';
import { validateChatMessage, isChatMessageBlocked } from '@/utils/chatMessageValidation';
import { getNavBarTopPadding } from '@/utils/safeAreaInsets';

const UI = AppUI;
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

type MessageStatus = 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  text: string;
  isSelf: boolean;
  time: string;
  status?: MessageStatus;
}

function PeerAvatar({ peer, size = 40 }: { peer: ChatPeer; size?: number }) {
  const radius = size / 2;
  if (peer.avatar) {
    return (
      <Image
        source={{ uri: peer.avatar }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: UI.surfaceMuted }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: UI.accent,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Ionicons name="person" size={Math.round(size * 0.55)} color="#fff" />
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
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const mountedRef = useRef(true);
  const myUserIdRef = useRef('');

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

      sock.on('peer:disconnected', () => {
        Alert.alert('Partner left', 'Your chat partner disconnected. Finding someone new...');
        beginSearch();
      });
    },
    [appendMessage, beginSearch, markMessagesRead, patchMessageById, resetChat]
  );

  const connectAndStartChat = useCallback(async () => {
    try {
      setStatus('connecting');
      setErrorMsg('');
      setNeedsSignIn(false);

      const loggedIn = await isLoggedInLocally();
      if (!loggedIn) {
        setNeedsSignIn(true);
        setErrorMsg('Please sign in to chat with real learners.');
        setStatus('error');
        return;
      }

      await ensureValidSession();

      disconnectChatSocket();

      const uid = await AsyncStorage.getItem(AUTH_KEYS.userId);
      if (uid) {
        myUserIdRef.current = uid;
        setMyUserId(uid);
      }

      const sock = await connectChatSocket();
      if (!mountedRef.current) return;

      attachChatHandlers(sock);
      setStatus('searching');
      startMatchmaking(sock);
    } catch (e) {
      if (!mountedRef.current) return;
      setErrorMsg(e instanceof Error ? e.message : 'Could not connect to chat server.');
      setStatus('error');
    }
  }, [attachChatHandlers]);

  useEffect(() => {
    mountedRef.current = true;
    connectAndStartChat();
    return () => {
      mountedRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      disconnectChatSocket();
    };
  }, [connectAndStartChat]);

  const retryChatConnection = useCallback(() => {
    mountedRef.current = true;
    connectAndStartChat();
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

  const renderNavHeader = (
    title: string,
    subtitle: string,
    options?: {
      peer?: ChatPeer;
      onSkip?: () => void;
      subtitleAccent?: boolean;
      hideIcon?: boolean;
      backOnly?: boolean;
    }
  ) => {
    if (options?.backOnly) {
      return (
        <View style={[styles.navBar, styles.navBarBackOnly, { paddingTop: navBarTopPadding }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={12}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={UI.text} />
          </Pressable>
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
        {renderNavHeader('Chat in English', 'Connection issue')}
        <View style={styles.centeredBody}>
          <Feather name="wifi-off" size={48} color="#e60000" />
          <Text style={styles.centeredTitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retryChatConnection}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
          {needsSignIn ? (
            <TouchableOpacity
              style={styles.secondaryRetryBtn}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.secondaryRetryBtnText}>Sign in</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  if (status === 'connecting' || status === 'searching') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar
          barStyle="dark-content"
          backgroundColor={AppUI.bg}
          translucent={Platform.OS === 'android'}
        />
        {renderNavHeader('', '', { backOnly: true })}
        <View style={styles.matchmakingBody}>
          <MatchmakingScene />
        </View>
      </View>
    );
  }

  if (!peer) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={UI.bg}
        translucent={Platform.OS === 'android'}
      />

      {renderNavHeader(
        peer.name,
        isTyping ? 'typing…' : 'Online learner',
        {
          peer,
          onSkip: handleSkip,
          subtitleAccent: isTyping,
        }
      )}

      {showEncryptionNotice ? (
        <Pressable onPress={dismissKeyboard} style={styles.encryptionBanner}>
          <Feather name="lock" size={16} color={UI.accent} />
          <Text style={styles.encryptionText}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
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
    backgroundColor: UI.bg,
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
    gap: 10,
    backgroundColor: UI.accentGlow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  encryptionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: UI.textSecondary,
    fontWeight: '500',
  },
  messagesArea: {
    flex: 1,
    backgroundColor: UI.bg,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
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
    textAlign: 'center',
    color: UI.textSecondary,
    fontSize: 15,
    fontWeight: '500',
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
