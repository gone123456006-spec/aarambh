import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  StatusBar,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyboardStickyView,
  useKeyboardHandler,
  useResizeMode,
} from 'react-native-keyboard-controller';
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
  getChatSocket,
  type ChatPeer,
} from '@/utils/chatSocket';
import { getAccessToken } from '@/utils/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import { MatchmakingScene } from '@/components/MatchmakingScene';

interface Message {
  id: string;
  text: string;
  isSelf: boolean;
  time: string;
}

const EXTRA_LIST_SPACING = 16;
const DEFAULT_INPUT_DOCK_HEIGHT = 56;

const LEVEL_LABELS: Record<string, string> = {
  starting: 'Starting',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function formatPeerLevel(level?: string) {
  if (!level) return '';
  return LEVEL_LABELS[level] || level;
}

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

function peerStatusLine(peer: ChatPeer, isTyping: boolean) {
  if (isTyping) return 'typing...';
  const region = peer.region || peer.location;
  const level = formatPeerLevel(peer.level);
  const parts = [region, level, peer.gender].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'English learner';
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputDockHeight, setInputDockHeight] = useState(DEFAULT_INPUT_DOCK_HEIGHT);

  useResizeMode();

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const appendMessage = useCallback((text: string, isSelf: boolean, id?: string) => {
    const newMessage: Message = {
      id: id ?? `${Date.now()}-${Math.random()}`,
      text,
      isSelf,
      time: getCurrentTime(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const resetChat = useCallback(() => {
    setPeer(null);
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
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const onKeyboardHeightChange = useCallback(
    (height: number) => {
      setKeyboardHeight(height);
      if (messages.length > 0) scrollToEnd(true);
    },
    [messages.length, scrollToEnd]
  );

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        runOnJS(onKeyboardHeightChange)(e.height);
      },
      onEnd: (e) => {
        'worklet';
        runOnJS(onKeyboardHeightChange)(e.height);
      },
    },
    [onKeyboardHeightChange]
  );

  useEffect(() => {
    if (messages.length === 0) return;
    scrollToEnd(true);
  }, [messages.length, keyboardHeight, inputDockHeight, isTyping, scrollToEnd]);

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
          setSessionId(data.sessionId);
          setPeer(data.peer);
          setStatus('chat');
          setMessages([]);
        });

        sock.on('message:receive', (payload: { id: string; text: string; senderId: string }) => {
          const currentUid = uid ?? myUserId;
          if (payload.senderId === currentUid) return;
          appendMessage(payload.text, false, payload.id);
          setIsTyping(false);
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
  }, [appendMessage, beginSearch, resetChat]);

  const handleSend = () => {
    const text = inputText.trim();
    const sock = getChatSocket();
    if (!text || !sock || !sessionId) return;

    appendMessage(text, true);
    sendChatMessage(sock, sessionId, text);
    setInputText('');
    emitTypingStop(sock, sessionId);
    setTimeout(() => scrollToEnd(true), 50);
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

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageWrapper, item.isSelf ? styles.messageWrapperSelf : styles.messageWrapperPeer]}>
      <View style={[styles.messageBubble, item.isSelf ? styles.messageBubbleSelf : styles.messageBubblePeer]}>
        <Text style={[styles.messageText, item.isSelf ? styles.messageTextSelf : styles.messageTextPeer]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  const renderChatInputBar = () => (
    <View style={styles.inputRow}>
      <View style={styles.inputPill}>
        <TextInput
          style={styles.textInput}
          placeholder="Message"
          placeholderTextColor="#8696a0"
          value={inputText}
          onChangeText={handleInputChange}
          onFocus={scrollToEnd}
          multiline
          maxLength={500}
          blurOnSubmit={false}
        />
      </View>
      {inputText.trim().length > 0 && (
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.85}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  const listBottomPadding =
    inputDockHeight + keyboardHeight + EXTRA_LIST_SPACING + (isTyping ? 28 : 0);

  const stickyOffset = { closed: Math.max(insets.bottom, 8), opened: 0 };

  const renderNavHeader = (
    title: string,
    subtitle: string,
    options?: { peer?: ChatPeer; onSkip?: () => void }
  ) => (
    <LinearGradient
      colors={['#FFD6D6', '#FFF0F0', '#F8F9FA']}
      locations={[0, 0.55, 1]}
      style={[styles.header, { paddingTop: insets.top }]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={24} color="#1F1F1F" />
        </TouchableOpacity>

        {options?.peer ? (
          <View style={styles.headerAvatarWrap}>
            <PeerAvatar peer={options.peer} />
            <View style={styles.onlineBadge} />
          </View>
        ) : null}

        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.headerSub, isTyping && options?.peer && styles.headerSubTyping]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {options?.onSkip ? (
          <TouchableOpacity
            onPress={options.onSkip}
            style={styles.actionPill}
            activeOpacity={0.7}
          >
            <Ionicons name="play-skip-forward" size={16} color="#e60000" />
            <Text style={styles.actionPillText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRightSpacer} />
        )}
      </View>
    </LinearGradient>
  );

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor="#FFE8E8" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#FFE8E8" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFE8E8" />

      {renderNavHeader(peer.name, peerStatusLine(peer, isTyping), {
        peer,
        onSkip: handleSkip,
      })}

      <View style={styles.infoBanner}>
        <Feather name="users" size={14} color="#00b894" />
        <Text style={styles.infoBannerText}>
          You are chatting with a real signed-in learner. Be polite and respectful.
        </Text>
      </View>

      <KeyboardAvoidingView style={styles.flex1} behavior="padding" enabled={false}>
        <View style={styles.messagesArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messageList}
            contentContainerStyle={[
              styles.chatContent,
              { paddingBottom: listBottomPadding },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scrollToEnd(false)}
            ListEmptyComponent={
              <Text style={styles.emptyChat}>Say hello to {peer.name}!</Text>
            }
            ListFooterComponent={
              isTyping ? (
                <View style={styles.typingIndicatorContainer}>
                  <Text style={styles.typingText}>{peer.name} is typing...</Text>
                </View>
              ) : null
            }
          />

          <KeyboardStickyView offset={stickyOffset} style={styles.stickyWrapper}>
            <View
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                if (h > 0 && h !== inputDockHeight) setInputDockHeight(h);
              }}
              style={styles.inputDock}
            >
              {renderChatInputBar()}
            </View>
          </KeyboardStickyView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  flex1: { flex: 1 },
  header: { paddingBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: 12,
  },
  backBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatarWrap: { position: 'relative', marginRight: 10 },
  headerTextBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  headerSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5F6368',
    marginTop: 2,
    lineHeight: 20,
  },
  headerSubTyping: { color: '#00b894', fontWeight: '500' },
  headerRightSpacer: { width: 12 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  actionPillText: { fontSize: 14, fontWeight: '600', color: '#e60000' },
  centeredBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centeredTitle: {
    fontSize: 16,
    color: '#5F6368',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: '#e60000',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fff4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  infoBannerText: { flex: 1, fontSize: 12, color: '#2d6a4f' },
  messagesArea: {
    flex: 1,
    backgroundColor: '#efeae2',
  },
  messageList: { flex: 1 },
  stickyWrapper: {
    width: '100%',
  },
  chatContent: {
    paddingHorizontal: 10,
    paddingTop: 12,
    flexGrow: 1,
  },
  emptyChat: { textAlign: 'center', color: '#667781', marginTop: 40, fontSize: 15 },
  messageWrapper: { marginBottom: 4, maxWidth: '82%' },
  messageWrapperSelf: { alignSelf: 'flex-end' },
  messageWrapperPeer: { alignSelf: 'flex-start' },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '100%',
  },
  messageBubbleSelf: {
    backgroundColor: '#d9fdd3',
    borderTopRightRadius: 0,
  },
  messageBubblePeer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 0,
  },
  messageText: { fontSize: 16, lineHeight: 21 },
  messageTextSelf: { color: '#111b21' },
  messageTextPeer: { color: '#111b21' },
  typingIndicatorContainer: { paddingVertical: 6, paddingHorizontal: 4 },
  typingText: { fontSize: 13, color: '#667781', fontStyle: 'italic' },
  inputDock: {
    backgroundColor: '#f0f2f5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d7db',
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputPill: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e9edef',
  },
  textInput: {
    fontSize: 16,
    lineHeight: 20,
    color: '#111b21',
    maxHeight: 100,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e60000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});
