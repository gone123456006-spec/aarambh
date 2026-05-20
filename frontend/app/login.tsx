import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

type LoginStep = 'EMAIL_INPUT' | 'OTP_INPUT';

const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i;

function isValidGmail(email: string) {
  return GMAIL_REGEX.test(email.trim());
}

export default function LoginScreen() {
  const [step, setStep] = useState<LoginStep>('EMAIL_INPUT');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const gmailValid = isValidGmail(email);

  const handleSendOTP = () => {
    if (gmailValid) {
      setStep('OTP_INPUT');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length === 6) {
      try {
        await AsyncStorage.setItem('userEmail', email.trim().toLowerCase());
        router.replace('/create-profile');
      } catch (e) {
        console.error('Failed to save email', e);
        router.replace('/create-profile');
      }
    }
  };

  const renderHeaderTitle = () => {
    return step === 'EMAIL_INPUT' ? 'Enter Gmail Account' : 'Verify OTP';
  };

  const renderHeaderSubtitle = () => {
    return step === 'EMAIL_INPUT'
      ? 'We will send a 6-digit code to verify your Gmail.'
      : `Code sent to ${email.trim().toLowerCase()}`;
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
                onChangeText={setEmail}
                autoFocus
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
                onChangeText={setOtp}
                autoFocus
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
                !gmailValid && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSendOTP}
              disabled={!gmailValid}
            >
              <Text style={styles.buttonText}>Send OTP</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                otp.length < 6 && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleVerifyOTP}
              disabled={otp.length < 6}
            >
              <Text style={styles.buttonText}>Verify & Login</Text>
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
