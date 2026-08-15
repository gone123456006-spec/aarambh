import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze, enableScreens } from 'react-native-screens';
import 'react-native-reanimated';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  stackFadeScreen,
  stackModalScreen,
  stackScreenOptions,
  stackSlideScreen,
} from '@/constants/navigationTransitions';
import { startApiKeepAlive } from '@/utils/checkApiHealth';
import { initWebRTC } from '@/utils/webrtcNative';
import AppUpdatePrompt from '@/components/AppUpdatePrompt';
import { startPersistentSessionMaintenance } from '@/utils/persistentSession';
import { NotificationProvider } from '@/contexts/NotificationContext';

enableScreens(true);
initWebRTC();
enableFreeze(false);

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      void SystemUI.setBackgroundColorAsync('#FFFFFF');
    }
  }, []);

  useEffect(() => {
    return startApiKeepAlive(60_000);
  }, []);

  useEffect(() => {
    return startPersistentSessionMaintenance();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <KeyboardProvider preload={false}>
          <NotificationProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="intro" options={stackFadeScreen} />
            <Stack.Screen name="login" options={stackSlideScreen} />
            <Stack.Screen name="create-profile" options={stackSlideScreen} />
            <Stack.Screen name="(tabs)" options={stackFadeScreen} />
            <Stack.Screen name="profile" options={stackSlideScreen} />
            <Stack.Screen name="leaderboard" options={stackSlideScreen} />
            <Stack.Screen name="performance" options={stackSlideScreen} />
            <Stack.Screen name="random-chat" options={stackSlideScreen} />
            <Stack.Screen name="about" options={stackSlideScreen} />
            <Stack.Screen name="contact-us" options={stackSlideScreen} />
            <Stack.Screen name="terms" options={stackSlideScreen} />
            <Stack.Screen name="privacy" options={stackSlideScreen} />
            <Stack.Screen name="settings" options={stackSlideScreen} />
            <Stack.Screen
              name="modal"
              options={{
                ...stackModalScreen,
                title: 'Modal',
              }}
            />
          </Stack>
          <AppUpdatePrompt />
          <StatusBar style="auto" />
        </ThemeProvider>
          </NotificationProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
