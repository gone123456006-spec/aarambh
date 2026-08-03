import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS, updateAuthUserAvatar } from '@/utils/authStorage';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import UserAvatar from '@/components/UserAvatar';
import { fetchMyProfile } from '@/utils/authApi';
import { uploadUserAvatar } from '@/utils/avatarApi';
import { pickProfileImageUri } from '@/utils/pickProfileImage';
import {
  SubscriptionSummary,
  FREE_SUBSCRIPTION,
  PRO_PRICE_LABEL,
  fetchSubscription,
  purchaseWithRazorpay,
  formatSubscriptionDate,
} from '@/utils/subscriptionApi';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState({
    name: '',
    region: '',
    gender: '',
    email: '',
    phone: '',
    level: '',
    avatar: '',
  });

  const [subscription, setSubscription] = useState<SubscriptionSummary>(FREE_SUBSCRIPTION);
  const [subLoading, setSubLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadSubscription = React.useCallback(async () => {
    try {
      const summary = await fetchSubscription();
      setSubscription(summary);
    } catch {
      setSubscription(FREE_SUBSCRIPTION);
    } finally {
      setSubLoading(false);
    }
  }, []);

  const runPurchase = React.useCallback(async () => {
    setPurchasing(true);
    try {
      const summary = await purchaseWithRazorpay();
      setSubscription(summary);
      Alert.alert(
        'Pro activated 🎉',
        `Your Pro subscription is active until ${formatSubscriptionDate(summary.expiryDate)}. Intermediate and Advanced courses are now unlocked.`
      );
    } catch (e: any) {
      const message = e?.message || 'Could not complete the payment. Please try again.';
      if (/payment cancelled/i.test(message)) {
        return;
      }
      Alert.alert('Payment failed', message);
    } finally {
      setPurchasing(false);
    }
  }, []);

  const handleBuyOrRenew = React.useCallback(() => {
    const isRenew = subscription.status === 'active' || subscription.status === 'expired';
    Alert.alert(
      isRenew ? 'Renew Pro subscription' : 'Buy Pro subscription',
      `Pro plan • ${PRO_PRICE_LABEL}\n\nPay securely with Razorpay to unlock Intermediate and Advanced courses for 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Pay ${PRO_PRICE_LABEL.split('/')[0]}`, onPress: () => void runPurchase() },
      ]
    );
  }, [subscription.status, runPurchase]);

  const loadProfile = React.useCallback(async () => {
      try {
        const [name, region, gender, email, phone, level, avatar] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEYS.userName),
          AsyncStorage.getItem(AUTH_KEYS.userRegion),
          AsyncStorage.getItem(AUTH_KEYS.gender),
          AsyncStorage.getItem(AUTH_KEYS.userEmail),
          AsyncStorage.getItem(AUTH_KEYS.userPhone),
          AsyncStorage.getItem(AUTH_KEYS.level),
          AsyncStorage.getItem(AUTH_KEYS.userAvatar),
        ]);
        setProfile({
          name: name || 'User',
          region: region || 'Not Set',
          gender: gender || 'Not Set',
          email: email || 'user@gmail.com',
          phone: phone || '',
          level: level || 'Beginner',
          avatar: avatar || '',
        });

        try {
          const remote = await fetchMyProfile();
          if (remote.avatar !== undefined) {
            await updateAuthUserAvatar(remote.avatar || '');
            setProfile((prev) => ({
              ...prev,
              name: remote.name || prev.name,
              avatar: remote.avatar || '',
            }));
          }
        } catch {
          /* keep cached profile */
        }
      } catch (e) {
        console.error('Failed to load profile', e);
      }
  }, []);

  const handleChangeAvatar = React.useCallback(async () => {
    if (uploadingAvatar) return;

    const localUri = await pickProfileImageUri();
    if (!localUri) return;

    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadUserAvatar(localUri);
      await updateAuthUserAvatar(avatarUrl);
      setProfile((prev) => ({ ...prev, avatar: avatarUrl }));
      Alert.alert('Profile picture updated', 'Your photo will appear across the app.');
    } catch (e) {
      Alert.alert(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload profile picture.'
      );
    } finally {
      setUploadingAvatar(false);
    }
  }, [uploadingAvatar]);

  useEffect(() => {
    loadProfile();
    loadSubscription();
  }, [loadProfile, loadSubscription]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadSubscription();
    }, [loadProfile, loadSubscription])
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Background Gradient */}
      <LinearGradient
        colors={['#f0f7ff', '#fff0f5']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1a202c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarContainer}>
            <UserAvatar name={profile.name} avatar={profile.avatar} size={90} />
            <TouchableOpacity
              style={styles.editBadge}
              onPress={() => void handleChangeAvatar()}
              disabled={uploadingAvatar}
              accessibilityLabel="Change profile picture"
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#e60000" />
              ) : (
                <Feather name="camera" size={14} color="#e60000" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile.name}</Text>
            <Text style={styles.userEmail}>{profile.email}</Text>
            {profile.phone ? (
              <Text style={styles.userPhone}>+91 {profile.phone}</Text>
            ) : null}
          </View>
        </View>

        {/* Subscription Card */}
        {(() => {
          const isPro = subscription.active;
          const gradient: [string, string] = isPro ? ['#7b4dff', '#b06bff'] : ['#2d3748', '#4a5568'];
          const statusLabel = isPro
            ? 'Active'
            : subscription.status === 'expired'
              ? 'Expired'
              : 'Free plan';
          return (
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.subCard}>
              <View style={styles.subHeaderRow}>
                <View style={styles.subTitleWrap}>
                  <MaterialCommunityIcons name={isPro ? 'crown' : 'crown-outline'} size={22} color="#ffd166" />
                  <Text style={styles.subPlanName}>{isPro ? 'Pro Subscription' : 'Free Plan'}</Text>
                </View>
                <View style={[styles.subBadge, isPro ? styles.subBadgeActive : styles.subBadgeInactive]}>
                  <Text style={styles.subBadgeText}>{statusLabel}</Text>
                </View>
              </View>

              <Text style={styles.subPrice}>
                {PRO_PRICE_LABEL}
                <Text style={styles.subPriceSub}>  •  Unlocks Intermediate & Advanced</Text>
              </Text>

              {subLoading ? (
                <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} />
              ) : isPro ? (
                <View style={styles.subMetaBox}>
                  <View style={styles.subMetaRow}>
                    <Text style={styles.subMetaLabel}>Start date</Text>
                    <Text style={styles.subMetaValue}>{formatSubscriptionDate(subscription.startDate)}</Text>
                  </View>
                  <View style={styles.subMetaRow}>
                    <Text style={styles.subMetaLabel}>Expiry date</Text>
                    <Text style={styles.subMetaValue}>{formatSubscriptionDate(subscription.expiryDate)}</Text>
                  </View>
                  <View style={styles.subMetaRow}>
                    <Text style={styles.subMetaLabel}>Remaining</Text>
                    <Text style={styles.subMetaValue}>
                      {subscription.remainingDays} day{subscription.remainingDays === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.subInfoText}>
                  {subscription.status === 'expired'
                    ? 'Your Pro subscription has expired. Renew to unlock Pro courses again — your progress is saved.'
                    : 'Beginner courses are free. Go Pro to unlock all Intermediate and Advanced courses.'}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.subBuyBtn, purchasing && { opacity: 0.7 }]}
                onPress={handleBuyOrRenew}
                disabled={purchasing || subLoading}
                activeOpacity={0.9}
              >
                {purchasing ? (
                  <ActivityIndicator color="#4a2b8a" />
                ) : (
                  <>
                    <Feather name={isPro ? 'refresh-cw' : 'unlock'} size={18} color="#4a2b8a" />
                    <Text style={styles.subBuyBtnText}>
                      {isPro ? 'Renew Subscription' : subscription.status === 'expired' ? 'Renew Subscription' : 'Buy Subscription'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </LinearGradient>
          );
        })()}

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialCommunityIcons name="school-outline" size={22} color="#718096" />
              <Text style={styles.cardTitle}>Profile Details</Text>
            </View>
            <TouchableOpacity style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {profile.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>Mobile</Text>
              <Text style={styles.value}>+91 {profile.phone}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Region</Text>
            <Text style={styles.value}>{profile.region}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Gender</Text>
            <Text style={styles.value}>{profile.gender}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Learning Level</Text>
            <Text style={styles.value}>{profile.level}</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a202c',
  },
  userEmail: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
    fontWeight: '500',
  },
  userPhone: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
    fontWeight: '500',
  },
  subCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subPlanName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  subBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subBadgeActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.95)',
  },
  subBadgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  subBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  subPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
  },
  subPriceSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  subMetaBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    gap: 4,
  },
  subMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  subMetaLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  subMetaValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  subInfoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  subBuyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  subBuyBtnText: {
    color: '#4a2b8a',
    fontSize: 15,
    fontWeight: '800',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a202c',
  },
  changeBtn: {
    borderWidth: 1,
    borderColor: '#ff7f50',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeBtnText: {
    color: '#ff7f50',
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a202c',
  },
  optionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f7fafc',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
});
