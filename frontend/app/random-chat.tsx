import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Platform,
  StatusBar,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  Alert
} from 'react-native';
import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface Message {
  id: string;
  text: string;
  isSelf: boolean;
  time: string;
}

const PEER_PROFILES = [
  { name: 'Alex', location: 'Canada', avatar: 'https://i.pravatar.cc/150?img=11' },
  { name: 'Sarah', location: 'UK', avatar: 'https://i.pravatar.cc/150?img=5' },
  { name: 'Miguel', location: 'Spain', avatar: 'https://i.pravatar.cc/150?img=12' },
  { name: 'Yuki', location: 'Japan', avatar: 'https://i.pravatar.cc/150?img=9' },
  { name: 'Emma', location: 'Australia', avatar: 'https://i.pravatar.cc/150?img=1' },
];

const SIMULATED_REPLIES = [
  "That's interesting! Tell me more.",
  "I agree with you.",
  "Wow, I didn't know that.",
  "How's the weather there?",
  "I'm learning English too! It's fun but challenging.",
  "Could you explain that?",
  "Haha, nice one!",
  "What do you like to do in your free time?",
  "Have you watched any good movies lately?",
];

export default function RandomChatScreen() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(true);
  const [peer, setPeer] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleFeatureNotAdded = () => {
    Alert.alert('Feature Coming Soon', 'This feature is not added yet.');
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    // Pulse animation for connecting state
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Simulate finding a peer
    const connectTimer = setTimeout(() => {
      const randomPeer = PEER_PROFILES[Math.floor(Math.random() * PEER_PROFILES.length)];
      setPeer(randomPeer);
      setIsConnecting(false);

      // Peer sends first message after connecting
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(`Hi there! I'm ${randomPeer.name} from ${randomPeer.location}. Nice to meet you!`, false);
        }, 1500);
      }, 1000);

    }, 3000);

    return () => clearTimeout(connectTimer);
  }, []);

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const addMessage = (text: string, isSelf: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(),
      text,
      isSelf,
      time: getCurrentTime(),
    };
    setMessages(prev => [...prev, newMessage]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = () => {
    if (inputText.trim().length === 0) return;

    addMessage(inputText.trim(), true);
    setInputText('');

    // Simulate peer replying
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const randomReply = SIMULATED_REPLIES[Math.floor(Math.random() * SIMULATED_REPLIES.length)];
        addMessage(randomReply, false);
      }, 1500 + Math.random() * 2000);
    }, 1000);
  };

  const handleSkip = () => {
    setIsConnecting(true);
    setPeer(null);
    setMessages([]);
    setIsTyping(false);

    setTimeout(() => {
      const randomPeer = PEER_PROFILES[Math.floor(Math.random() * PEER_PROFILES.length)];
      setPeer(randomPeer);
      setIsConnecting(false);

      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          addMessage(`Hey! I'm ${randomPeer.name}. How are you doing?`, false);
        }, 1500);
      }, 1000);
    }, 2500);
  };

  if (isConnecting) {
    return (
      <View style={[styles.safeArea, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.connectingBackBtn}>
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Random Chat</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.connectingContainer}>
          <Animated.View style={[styles.radarCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="earth" size={60} color="#e60000" />
          </Animated.View>
          <Text style={styles.connectingTitle}>Looking for someone...</Text>
          <Text style={styles.connectingSub}>Matching you with an English speaker</Text>
          <ActivityIndicator size="large" color="#e60000" style={{ marginTop: 30 }} />
        </View>
      </View>
    );
  }

  const renderMessage = ({ item }: { item: Message }) => {
    return (
      <View style={[
        styles.messageWrapper,
        item.isSelf ? styles.messageWrapperSelf : styles.messageWrapperPeer
      ]}>
        <View style={[
          styles.messageBubble,
          item.isSelf ? styles.messageBubbleSelf : styles.messageBubblePeer
        ]}>
          <Text style={[styles.messageText, item.isSelf ? { color: '#fff' } : { color: '#000' }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const iosBottomPadding = insets.bottom > 0 ? insets.bottom : 10;
  const bottomPadding = Platform.OS === 'ios' && keyboardHeight > 0
    ? keyboardHeight + 10
    : iosBottomPadding;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={32} color="#000" />
          </TouchableOpacity>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: peer.avatar }} style={styles.peerAvatar} />
            <View style={styles.disappearingBadge}>
              <Feather name="clock" size={10} color="#fff" />
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.peerName} numberOfLines={1}>{peer.name}</Text>
            <Text style={[styles.peerStatus, isTyping && { color: '#00b894', fontWeight: '500' }]}>
              {isTyping ? 'typing...' : 'online'}
            </Text>
          </View>
        </View>
        <View style={styles.chatHeaderRight}>
          <TouchableOpacity onPress={handleFeatureNotAdded} style={styles.headerIcon}>
            <Feather name="video" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFeatureNotAdded} style={styles.headerIcon}>
            <Feather name="phone" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip} style={styles.headerIcon}>
            <Ionicons name="play-skip-forward" size={26} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Feather name="shield" size={14} color="#00b894" />
        <Text style={styles.infoBannerText}>Messages are end-to-end encrypted. Be polite and respectful.</Text>
      </View>

      {/* Chat Area */}
      <View style={styles.chatBackground}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            isTyping ? (
              <View style={styles.typingIndicatorContainer}>
                <Text style={styles.typingText}>{peer.name} is typing...</Text>
              </View>
            ) : null
          )}
        />
      </View>

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity onPress={handleFeatureNotAdded} style={styles.plusBtn}>
          <Feather name="plus" size={28} color="#000" />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder=""
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity onPress={handleFeatureNotAdded} style={styles.inputRightIcon}>
            <Ionicons name="document-outline" size={22} color="#000" />
          </TouchableOpacity>
        </View>
        {inputText.trim().length > 0 ? (
          <TouchableOpacity style={styles.sendBtnActive} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={handleFeatureNotAdded} style={styles.actionBtn}>
              <Feather name="camera" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleFeatureNotAdded} style={styles.actionBtn}>
              <Feather name="mic" size={24} color="#000" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  connectingBackBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    width: 40,
  },
  connectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  radarCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(230, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(230, 0, 0, 0.3)',
  },
  connectingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  connectingSub: {
    fontSize: 14,
    color: '#666',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 4,
  },
  unreadCount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginLeft: -4,
    marginRight: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  peerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ccc',
  },
  disappearingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#888',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F5F5F5',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  peerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  peerStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginRight: 4,
  },
  headerIcon: {
    padding: 4,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe5e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  skipBtnText: {
    color: '#e60000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1F4CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 6,
  },
  infoBannerText: {
    fontSize: 11,
    color: '#00b894',
    fontWeight: '500',
  },
  chatBackground: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  messageWrapperSelf: {
    justifyContent: 'flex-end',
  },
  messageWrapperPeer: {
    justifyContent: 'flex-start',
  },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#ccc',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageBubbleSelf: {
    backgroundColor: '#e60000',
    borderBottomRightRadius: 4,
  },
  messageBubblePeer: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },

  typingIndicatorContainer: {
    marginLeft: 16,
    marginBottom: 10,
  },
  typingText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  plusBtn: {
    padding: 8,
    paddingBottom: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 48,
    maxHeight: 120,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 48,
  },
  inputRightIcon: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionBtn: {
    padding: 10,
    paddingBottom: 12,
  },
  sendBtnActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e60000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    marginBottom: 2,
  },
});
