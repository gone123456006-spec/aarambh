import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { isLoggedInLocally } from '@/utils/authStorage';
import { bootstrapSession } from '@/utils/api';
import { warmApiServer } from '@/utils/checkApiHealth';
import { AppSplashScreen } from '@/components/AppSplashScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      warmApiServer();
      await bootstrapSession();
      const loggedIn = await isLoggedInLocally();
      if (cancelled) return;
      await SplashScreen.hideAsync();
      setHref(loggedIn ? '/(tabs)' : '/intro');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!href) {
    return (
      <View style={styles.root}>
        <AppSplashScreen />
      </View>
    );
  }

  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#5c0000',
  },
});
