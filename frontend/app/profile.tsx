import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar, Image } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_KEYS } from '@/utils/authStorage';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

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
  });

  const loadProfile = React.useCallback(async () => {
      try {
        const [name, region, gender, email, phone, level] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEYS.userName),
          AsyncStorage.getItem(AUTH_KEYS.userRegion),
          AsyncStorage.getItem(AUTH_KEYS.gender),
          AsyncStorage.getItem(AUTH_KEYS.userEmail),
          AsyncStorage.getItem(AUTH_KEYS.userPhone),
          AsyncStorage.getItem(AUTH_KEYS.level),
        ]);
        setProfile({
          name: name || 'User',
          region: region || 'Not Set',
          gender: gender || 'Not Set',
          email: email || 'user@gmail.com',
          phone: phone || '',
          level: level || 'Beginner',
        });
      } catch (e) {
        console.error('Failed to load profile', e);
      }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile])
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
            <View style={styles.avatar}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>
            <TouchableOpacity style={styles.editBadge}>
              <Feather name="edit-2" size={14} color="#e60000" />
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
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#95a5a6',
    borderWidth: 4,
    borderColor: '#ff9f43',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
