import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze, enableScreens } from 'react-native-screens';
import 'react-native-reanimated';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  stackFadeScreen,
  stackScreenOptions,
  stackSlideScreen,
} from '@/constants/navigationTransitions';

enableScreens(true);
enableFreeze(true);

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider preload={false}>
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
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                animationDuration: 300,
                title: 'Modal',
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
