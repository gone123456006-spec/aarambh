import { Tabs, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAccessToken } from '@/utils/authStorage';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAccessToken().then((token) => {
        if (active && !token) {
          router.replace('/intro');
        }
      });
      return () => {
        active = false;
      };
    }, [router])
  );
  const tabBarMargin = Platform.OS === 'ios' ? 26 : 20;
  const tabBarBottom = Math.max(insets.bottom - 30, 0);
  const tabBarTotalHeight = 50 + tabBarBottom + tabBarMargin;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    <Tabs
      screenOptions={{
        sceneContainerStyle: {
          paddingBottom: tabBarTotalHeight,
          backgroundColor: '#FFFFFF',
        },
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
        ),
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: tabBarMargin,
          borderTopWidth: 1,
          borderTopColor: '#E8EAED',
          backgroundColor: '#FFFFFF',
          height: 50 + tabBarBottom,
          paddingBottom: tabBarBottom,
          paddingTop: 6,
          elevation: 0,
        },
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
        name="courses"
        options={{
          title: 'Game',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gamecontroller.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ved"
        options={{
          title: 'Ved',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-courses"
        options={{
          title: 'My Courses',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="play.rectangle.fill" color={color} />,
        }}
      />
    </Tabs>
    </View>
  );
}
