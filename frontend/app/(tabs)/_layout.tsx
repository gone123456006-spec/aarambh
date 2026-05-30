import { Tabs, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { isLoggedInLocally } from '@/utils/authStorage';
import { ensureValidSession } from '@/utils/api';

import { HapticTab } from '@/components/haptic-tab';
import { RewardsTabIcon } from '@/components/RewardsTabIcon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppUI, Colors } from '@/constants/theme';
import {
  getDefaultTabBarStyle,
  getHiddenTabBarStyle,
  tabScreenOptions,
} from '@/constants/navigationTransitions';
import { GameTabBarProvider, useGameTabBar } from '@/contexts/game-tab-bar-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

function TabNavigator() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { hideTabBar } = useGameTabBar();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const loggedIn = await isLoggedInLocally();
        if (active && !loggedIn) {
          router.replace('/intro');
          return;
        }
        // Keep tokens fresh in background — never log out on refresh failure
        if (active) {
          await ensureValidSession();
        }
      })();
      return () => {
        active = false;
      };
    }, [router])
  );

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          ...tabScreenOptions,
          sceneContainerStyle: {
            backgroundColor: AppUI.bg,
          },
          tabBarActiveTintColor: '#e60000',
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFillObject, styles.tabBarBackground]} />
          ),
          tabBarStyle: hideTabBar
            ? getHiddenTabBarStyle()
            : getDefaultTabBarStyle(insets.bottom),
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="my-courses"
          options={{
            title: 'My Courses',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="play.rectangle.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="courses"
          options={{
            title: 'Games',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="gamecontroller.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: 'Rewards',
            tabBarIcon: ({ color }) => <RewardsTabIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="ved"
          options={{
            title: 'Support',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  return (
    <GameTabBarProvider>
      <TabNavigator />
    </GameTabBarProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBarBackground: {
    backgroundColor: '#FFFFFF',
  },
});
