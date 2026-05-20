import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const REGIONS = ['Ahmedabad', 'Bangalore', 'Chennai', 'Delhi'];
const LEVELS = [
  { id: 'starting', label: 'Just Starting', hindi: 'अभी शुरुआत कर रहे हैं' },
  { id: 'beginner', label: 'Beginner', hindi: 'शुरुआती' },
  { id: 'intermediate', label: 'Intermediate', hindi: 'मध्यम' },
  { id: 'advanced', label: 'Advanced', hindi: 'उन्नत' }
];
const GENDERS = ['Male', 'Female', 'Other'];
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function sanitizePhone(text: string) {
  return text.replace(/\D/g, '').slice(0, 10);
}

function isValidIndianMobile(phone: string) {
  return INDIAN_MOBILE_REGEX.test(phone);
}

export default function CreateProfileScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referral, setReferral] = useState('');
  const [gender, setGender] = useState('');
  const [region, setRegion] = useState('');
  const [level, setLevel] = useState('');

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedImageStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0.6],
      Extrapolation.CLAMP
    );

    const moveY = interpolate(
      scrollY.value,
      [0, 200],
      [0, -50],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollY.value,
      [0, 150],
      [1, 0.8],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY: translateY.value + moveY },
        { scale: scale }
      ],
      opacity: opacity
    };
  });

  const phoneValid = isValidIndianMobile(phone);
  const showPhoneError = phone.length > 0 && !phoneValid;

  const handleComplete = async () => {
    if (name && phoneValid && gender && region && level) {
      try {
        await AsyncStorage.setItem('userName', name);
        await AsyncStorage.setItem('userPhone', phone);
        await AsyncStorage.setItem('userRegion', region);
        await AsyncStorage.setItem('gender', gender);
        await AsyncStorage.setItem('level', level);
        router.replace('/(tabs)');
      } catch (e) {
        console.error('Failed to save profile', e);
        router.replace('/(tabs)');
      }
    }
  };

  const isFormValid = name && phoneValid && gender && region && level;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Illustration Section */}
          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.headerSection}>
            <Animated.View style={animatedImageStyle}>
              <Image
                source={require('../assets/images/cartoon_character.png')}
                style={styles.illustration}
                contentFit="contain"
              />
            </Animated.View>
            <View style={styles.titleWrapper}>
              <Text style={styles.title}>Create Your Profile</Text>
              <Text style={styles.subtitle}>Help us customize your learning journey!</Text>
            </View>
          </Animated.View>

          {/* Form Section */}
          <View style={styles.form}>
            {/* Name Input */}
            <Animated.View entering={FadeInDown.delay(400)} style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#999"
                />
              </View>
            </Animated.View>

            {/* Mobile Number */}
            <Animated.View entering={FadeInDown.delay(450)} style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={[styles.inputWrapper, showPhoneError && styles.inputWrapperError]}>
                <Feather name="phone" size={20} color="#666" style={styles.inputIcon} />
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="98765 43210"
                  value={phone}
                  onChangeText={(text) => setPhone(sanitizePhone(text))}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholderTextColor="#999"
                />
              </View>
              {showPhoneError ? (
                <Text style={styles.errorText}>Enter a valid mobile number</Text>
              ) : null}
            </Animated.View>

            {/* Referral Code */}
            <Animated.View entering={FadeInDown.delay(500)} style={styles.inputGroup}>
              <Text style={styles.label}>Referral Code (Optional)</Text>
              <View style={styles.inputWrapper}>
                <Feather name="gift" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter code if any"
                  value={referral}
                  onChangeText={setReferral}
                  placeholderTextColor="#999"
                />
              </View>
            </Animated.View>

            {/* Gender Selection */}
            <Animated.View entering={FadeInDown.delay(600)} style={styles.inputGroup}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.optionsRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[styles.optionChip, gender === g && styles.optionChipActive]}
                  >
                    <Text style={[styles.optionChipText, gender === g && styles.optionChipTextActive]}>
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Region Selection */}
            <Animated.View entering={FadeInDown.delay(700)} style={styles.inputGroup}>
              <Text style={styles.label}>Select Your Region</Text>
              <View style={styles.gridOptions}>
                {REGIONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRegion(r)}
                    style={[styles.gridOption, region === r && styles.gridOptionActive]}
                  >
                    <Text style={[styles.gridOptionText, region === r && styles.gridOptionTextActive]}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* English Level */}
            <Animated.View entering={FadeInDown.delay(800)} style={styles.inputGroup}>
              <Text style={styles.label}>What's your English level?</Text>
              {LEVELS.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => setLevel(l.id)}
                  style={[styles.levelCard, level === l.id && styles.levelCardActive]}
                >
                  <View style={styles.levelInfo}>
                    <Text style={[styles.levelLabel, level === l.id && styles.levelLabelActive]}>
                      {l.label}
                    </Text>
                    <Text style={[styles.levelHindi, level === l.id && styles.levelHindiActive]}>
                      {l.hindi}
                    </Text>
                  </View>
                  {level === l.id && (
                    <Animated.View entering={FadeInRight}>
                      <Feather name="check-circle" size={24} color="#e60000" />
                    </Animated.View>
                  )}
                </Pressable>
              ))}
            </Animated.View>
          </View>

          {/* Action Button */}
          <Animated.View entering={FadeInDown.delay(900)} style={styles.footer}>
            <Pressable
              onPress={handleComplete}
              disabled={!isFormValid}
              style={({ pressed }) => [
                styles.submitButton,
                !isFormValid && styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed
              ]}
            >
              <LinearGradient
                colors={isFormValid ? ['#e60000', '#ff4d4d'] : ['#ff9999', '#ff9999']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.submitButtonText}>Let's Start Learning</Text>
                <Feather name="arrow-right" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  illustration: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  titleWrapper: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    letterSpacing: 0.5,
  },
  inputWrapperError: {
    borderColor: '#e60000',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    fontSize: 12,
    color: '#e60000',
    marginTop: 2,
    fontWeight: '500',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
  },
  optionChipActive: {
    backgroundColor: '#fff',
    borderColor: '#e60000',
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  optionChipTextActive: {
    color: '#e60000',
  },
  gridOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridOption: {
    width: (width - 48 - 12) / 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  gridOptionActive: {
    backgroundColor: '#fff',
    borderColor: '#e60000',
  },
  gridOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  gridOptionTextActive: {
    color: '#e60000',
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  levelCardActive: {
    backgroundColor: '#fff',
    borderColor: '#e60000',
    shadowColor: '#e60000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  levelInfo: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  levelLabelActive: {
    color: '#e60000',
  },
  levelHindi: {
    fontSize: 14,
    color: '#888',
  },
  levelHindiActive: {
    color: '#e60000',
    opacity: 0.8,
  },
  footer: {
    marginTop: 40,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  gradient: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
