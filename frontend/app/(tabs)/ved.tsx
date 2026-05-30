import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  Pressable,
  StatusBar,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import { runOnJS } from 'react-native-reanimated';
import { ASSISTANT_NAME, VED_FAQ, VED_WELCOME, getVedReply } from '@/constants/vedFaq';
import { getAndroidHeaderCompactStyle } from '@/utils/safeAreaInsets';

type ChatMessage = {
  id: string;
  text: string;
  from: 'user' | 'bot';
};

const UI = {
  bg: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FA',
  text: '#101010',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#e60000',
  accentGlow: 'rgba(230, 0, 0, 0.12)',
  userBubble: '#5b9bd5',
  divider: 'rgba(0,0,0,0.06)',
  shadow: '#000000',
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

const BOT_REPLY_DELAY_MS = 500;
const ANDROID_KEYBOARD_FALLBACK = 280;
const ANDROID_NAV_BAR_HEIGHT = 48;
const DEFAULT_COMPOSER_HEIGHT = Platform.OS === 'android' ? 120 : 110;
const SCROLL_AFTER_KEYBOARD_MS = Platform.OS === 'android' ? 280 : 160;

export default function VedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const textInputRef = useRef<TextInput>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', text: VED_WELCOME, from: 'bot' },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(DEFAULT_COMPOSER_HEIGHT);

  const scrollToEnd = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const scrollToEndSmooth = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollToEnd(true);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollToEnd(true);
      scrollTimeoutRef.current = null;
    }, SCROLL_AFTER_KEYBOARD_MS);
  }, [scrollToEnd]);

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
    scrollToEndSmooth();
  }, [messages, isTyping, scrollToEndSmooth]);

  useEffect(() => {
    if (!inputFocused) return;
    scrollToEndSmooth();
  }, [inputFocused, composerHeight, scrollToEndSmooth]);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const sendUserMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        text: trimmed,
        from: 'user',
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setIsTyping(true);

      const reply = getVedReply(trimmed);
      replyTimerRef.current = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `bot-${Date.now()}`, text: reply, from: 'bot' },
        ]);
        setIsTyping(false);
      }, BOT_REPLY_DELAY_MS);
    },
    [isTyping]
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

  const listBottomSpacer = composerHeight + 16 + (isTyping ? 44 : 0);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.from === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={15} color="#fff" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={UI.bg}
        translucent={Platform.OS === 'android'}
      />

      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeTop}>
        <View style={[styles.navBar, getAndroidHeaderCompactStyle()]}>
          <Pressable
            onPress={() => router.navigate('/(tabs)/')}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={24} color={UI.text} />
          </Pressable>
          <View style={styles.headerAvatar}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {ASSISTANT_NAME}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Support & FAQ
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.chatRoot}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollToEnd(false)}
          ListHeaderComponent={
            <View style={styles.helpBanner}>
              <Feather name="help-circle" size={18} color={UI.accent} />
              <Text style={styles.helpBannerText}>
                Ask a question or tap a topic below for quick answers.
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {isTyping ? (
                <View style={styles.messageRow}>
                  <View style={styles.botAvatar}>
                    <Ionicons name="sparkles" size={15} color="#fff" />
                  </View>
                  <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={UI.accent} />
                    <Text style={styles.typingText}>Typing…</Text>
                  </View>
                </View>
              ) : null}
              <View style={{ height: listBottomSpacer }} />
            </>
          }
        />

        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={styles.composerSticky}>
          <View
            onLayout={(e) => {
              const h = Math.ceil(e.nativeEvent.layout.height);
              if (h > 0 && h !== composerHeight) setComposerHeight(h);
            }}
            style={[
              styles.composerDock,
              { paddingBottom: effectiveKeyboardHeight > 0 ? 8 : bottomInset + 8 },
            ]}
          >
            <Text style={styles.quickLabel}>Quick topics</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={VED_FAQ}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.quickTopicsContent}
              keyboardShouldPersistTaps="always"
              style={styles.quickTopics}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => sendUserMessage(item.label)}
                  disabled={isTyping}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <View style={styles.inputRow}>
              <View style={styles.inputPill}>
                <TextInput
                  ref={textInputRef}
                  style={styles.input}
                  placeholder="Type your question…"
                  placeholderTextColor={UI.textTertiary}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  editable={!isTyping}
                  onSubmitEditing={() => sendUserMessage(inputText)}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onFocus={() => {
                    setInputFocused(true);
                    scrollToEndSmooth();
                  }}
                  onBlur={() => setInputFocused(false)}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
                onPress={() => sendUserMessage(inputText)}
                disabled={!inputText.trim() || isTyping}
                activeOpacity={0.88}
              >
                <Feather name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
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
  safeTop: {
    backgroundColor: UI.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 2 : 0,
    paddingBottom: Platform.OS === 'android' ? 8 : 12,
    gap: 12,
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
  backBtnPressed: {
    opacity: 0.85,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
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
  },
  chatRoot: {
    flex: 1,
    flexDirection: 'column',
  },
  messageList: {
    flex: 1,
  },
  composerSticky: {
    width: '100%',
  },
  composerDock: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    marginHorizontal: 0,
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
  },
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: UI.accentGlow,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  helpBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: UI.textSecondary,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    maxWidth: '90%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleBot: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 6,
    ...cardShadow,
  },
  bubbleUser: {
    backgroundColor: UI.userBubble,
    borderTopRightRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: UI.text,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typingText: {
    fontSize: 13,
    color: UI.textSecondary,
    fontWeight: '500',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: UI.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 16,
    marginBottom: 8,
  },
  quickTopics: {
    maxHeight: 44,
    marginBottom: 10,
  },
  quickTopicsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: UI.surfaceMuted,
    borderWidth: 1,
    borderColor: UI.divider,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 4,
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
  },
  input: {
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: UI.text,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: UI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    ...cardShadow,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
