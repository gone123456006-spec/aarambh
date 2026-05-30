import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  fetchMyProfile,
  resolveProfileComplete,
  sendOtpEmail,
  verifyOtpCode,
} from '@/utils/authApi';
import { isProfileCompleteUser } from '@/utils/profile';
import { saveAuthSession, isLoggedInLocally } from '@/utils/authStorage';
import { syncUserDataFromServer } from '@/utils/userDataSync';
import { checkApiHealth } from '@/utils/checkApiHealth';

type LoginStep = 'EMAIL_INPUT' | 'OTP_INPUT';

const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i;

function isValidGmail(email: string) {
  return GMAIL_REGEX.test(email.trim());
}

export default function LoginScreen() {
  const [step, setStep] = useState<LoginStep>('EMAIL_INPUT');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionWarning, setConnectionWarning] = useState('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const runConnectionCheck = async () => {
    setCheckingConnection(true);
    setConnectionWarning('');
    const result = await checkApiHealth();
    setCheckingConnection(false);
    if (!result.ok) {
      setConnectionWarning(result.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    checkApiHealth().then((result) => {
      if (cancelled) return;
      setCheckingConnection(false);
      if (!result.ok) setConnectionWarning(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loggedIn = await isLoggedInLocally();
      if (!cancelled && loggedIn) {
        router.replace('/(tabs)');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const gmailValid = isValidGmail(email);
  const trimmedEmail = email.trim().toLowerCase();

  const handleSendOTP = async () => {
    if (!gmailValid || loading) return;
    setLoading(true);
    setError('');
    try {
      await sendOtpEmail(trimmedEmail);
      setStep('OTP_INPUT');
      setOtp('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP. Check backend & SMTP settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6 || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await verifyOtpCode(trimmedEmail, otp);
      const userId = String(data.user.id ?? data.user._id ?? '');
      await saveAuthSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: userId,
          email: data.user.email,
          name: data.user.name,
          phone: data.user.phone,
          gender: data.user.gender,
          region: data.user.region,
          level: data.user.level,
        },
      });

      let profileComplete = resolveProfileComplete(data);

      if (!profileComplete) {
        try {
          const profile = await fetchMyProfile();
          profileComplete = isProfileCompleteUser(profile);
        } catch {
          // Keep profileComplete false for new users
        }
      }

      if (profileComplete) {
        await syncUserDataFromServer();
        router.replace('/(tabs)');
      } else {
        router.replace('/create-profile');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderHeaderTitle = () => {
    return step === 'EMAIL_INPUT' ? 'Enter Gmail Account' : 'Verify OTP';
  };

  const renderHeaderSubtitle = () => {
    return step === 'EMAIL_INPUT'
      ? 'We will send a 6-digit code to verify your Gmail.'
      : `Code sent to ${trimmedEmail}`;
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (loading) return;
              step === 'OTP_INPUT' ? setStep('EMAIL_INPUT') : router.back();
            }}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#000" />
          </Pressable>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{renderHeaderTitle()}</Text>
          <Text style={styles.subtitle}>{renderHeaderSubtitle()}</Text>
          {checkingConnection ? (
            <View style={styles.connectionRow}>
              <ActivityIndicator size="small" color="#666666" />
              <Text style={styles.connectionText}>Connecting to Ohm&apos;s servers…</Text>
            </View>
          ) : null}
          {connectionWarning ? (
            <View style={styles.warningBlock}>
              <Text style={styles.warningText}>{connectionWarning}</Text>
              <Pressable onPress={runConnectionCheck} disabled={checkingConnection}>
                <Text style={styles.retryLink}>Retry connection</Text>
              </Pressable>
            </View>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.inputContainer}>
          {step === 'EMAIL_INPUT' ? (
            <View style={styles.emailInputWrapper}>
              <Feather name="mail" size={18} color="#000" style={styles.emailIcon} />
              <TextInput
                style={styles.emailInput}
                placeholder="name@gmail.com"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                autoFocus
                editable={!loading}
                numberOfLines={1}
                scrollEnabled
              />
            </View>
          ) : (
            <View style={styles.otpInputWrapper}>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="------"
                placeholderTextColor="#999999"
                selectionColor="#000000"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(text) => {
                  setOtp(text.replace(/\D/g, ''));
                  if (error) setError('');
                }}
                autoFocus
                editable={!loading}
                textAlign="center"
              />
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {step === 'EMAIL_INPUT' ? (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!gmailValid || loading) && styles.buttonDisabled,
                pressed && !loading && styles.buttonPressed,
              ]}
              onPress={handleSendOTP}
              disabled={!gmailValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (otp.length < 6 || loading) && styles.buttonDisabled,
                pressed && !loading && styles.buttonPressed,
              ]}
              onPress={handleVerifyOTP}
              disabled={otp.length < 6 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Login</Text>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  titleContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#e60000',
    lineHeight: 20,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  connectionText: {
    fontSize: 14,
    color: '#666666',
  },
  warningBlock: {
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#b45309',
    lineHeight: 20,
  },
  retryLink: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#e60000',
  },
  inputContainer: {
    paddingHorizontal: 24,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 6,
    minHeight: 40,
  },
  emailIcon: {
    marginRight: 10,
  },
  emailInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    padding: 0,
    minHeight: 36,
    includeFontPadding: false,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    padding: 0,
  },
  otpInputWrapper: {
    borderBottomWidth: 2,
    borderBottomColor: '#e60000',
    width: 280,
    alignSelf: 'center',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInput: {
    color: '#000000',
    fontSize: 32,
    fontWeight: 'bold',
    width: '100%',
    textAlign: 'center',
    height: 60,
    padding: 0,
    margin: 0,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#e60000',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ff9999',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
