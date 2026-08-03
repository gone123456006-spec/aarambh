import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppUI, cardShadow } from '@/constants/theme';
import { AppUpdateInfo, checkForAppUpdate } from '@/utils/appUpdate';

const APP_ICON = require('../assets/images/ohms-icon.png');

export default function AppUpdatePrompt() {
  const insets = useSafeAreaInsets();
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const info = await checkForAppUpdate();
      setUpdateInfo(info);
    } catch {
      // Never block the app if the version endpoint is temporarily unreachable.
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runCheck();
      }
    });
    return () => sub.remove();
  }, [runCheck]);

  const openStore = useCallback(async () => {
    if (!updateInfo?.storeUrl) return;
    try {
      await Linking.openURL(updateInfo.storeUrl);
    } catch {
      await Linking.openURL('https://play.google.com/store/apps/details?id=com.ohms.english');
    }
  }, [updateInfo?.storeUrl]);

  if (!updateInfo) return null;

  const canSkip = updateInfo.optional && !updateInfo.required;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => {
        if (canSkip) setUpdateInfo(null);
      }}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 16) + 12,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.kicker}>Update available</Text>
          {canSkip ? (
            <TouchableOpacity
              onPress={() => setUpdateInfo(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.laterText}>Later</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={[styles.logoWrap, cardShadow]}>
            <Image source={APP_ICON} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.title}>Update your app</Text>
          <Text style={styles.message}>{updateInfo.message}</Text>

          <View style={styles.versionBox}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Installed version</Text>
              <Text style={styles.versionValue}>
                v{updateInfo.currentVersion}
                {updateInfo.currentBuildNumber ? ` (${updateInfo.currentBuildNumber})` : ''}
              </Text>
            </View>
            <View style={styles.line} />
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Latest version</Text>
              <Text style={styles.versionValue}>
                v{updateInfo.latestVersion}
                {updateInfo.latestBuildNumber ? ` (${updateInfo.latestBuildNumber})` : ''}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.updateBtn} onPress={openStore} activeOpacity={0.88}>
          {checking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="download" size={18} color="#FFFFFF" />
              <Text style={styles.updateBtnText}>Update from Play Store</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === 'android' ? (
          <Text style={styles.footerText}>
            After updating, reopen Ohm&apos;s English to continue learning.
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppUI.bg,
    paddingHorizontal: 24,
  },
  topRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: AppUI.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  laterText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppUI.textSecondary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 112,
    height: 112,
    borderRadius: 28,
    backgroundColor: AppUI.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 18,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: AppUI.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: AppUI.textSecondary,
    textAlign: 'center',
    maxWidth: 330,
    marginBottom: 24,
  },
  versionBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    backgroundColor: AppUI.surface,
    padding: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  versionLabel: {
    fontSize: 13,
    color: AppUI.textSecondary,
  },
  versionValue: {
    fontSize: 13,
    fontWeight: '800',
    color: AppUI.text,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 12,
  },
  updateBtn: {
    backgroundColor: AppUI.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  updateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerText: {
    fontSize: 12,
    color: AppUI.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
});
