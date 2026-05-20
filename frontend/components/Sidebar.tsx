import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, Dimensions, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';


import { useRouter, router as expoRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const SESSION_KEYS = ['userName', 'userRegion', 'gender', 'level', 'userEmail', 'userPhone'];

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const router = useRouter();
  const [userName, setUserName] = React.useState('User');
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    const loadUser = async () => {
      const name = await AsyncStorage.getItem('userName');
      if (name) setUserName(name);
    };
    if (visible) loadUser();
  }, [visible]);

  const navigateToProfile = () => {
    onClose();
    router.push('/profile');
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    onClose();
    try {
      await AsyncStorage.multiRemove(SESSION_KEYS);
    } catch (e) {
      console.error('Failed to clear session on logout', e);
    }
    expoRouter.dismissAll();
    expoRouter.replace('/intro');
    setIsLoggingOut(false);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Sidebar content */}
        <View style={styles.sidebarContainer}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>

              {/* Profile Section */}
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  <Ionicons name="person" size={40} color="#999" />
                </View>
                <View style={styles.nameHeader}>
                  <Text style={styles.username}>{userName}</Text>
                  <TouchableOpacity onPress={navigateToProfile}>
                    <Feather name="edit-2" size={14} color="#e60000" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.viewProfileBtn} onPress={navigateToProfile}>
                  <Text style={styles.viewProfileText}>View Profile</Text>
                </TouchableOpacity>
              </View>

              {/* Menu Items */}
              <View style={styles.menuContainer}>

                <TouchableOpacity style={styles.menuItem}>
                  <Feather name="briefcase" size={22} color="#4A5568" />
                  <Text style={styles.menuText}>My Purchases</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                  <Feather name="info" size={22} color="#4A5568" />
                  <Text style={styles.menuText}>About Us</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                  <Feather name="phone-call" size={22} color="#4A5568" />
                  <Text style={styles.menuText}>Contact Us</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                  <Feather name="clipboard" size={22} color="#4A5568" />
                  <Text style={styles.menuText}>Terms & Conditions</Text>
                </TouchableOpacity>

              </View>

              {/* Footer Section */}
              <View style={styles.footerSection}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleLogout}
                  disabled={isLoggingOut}
                  activeOpacity={0.7}
                >
                  <Feather name="log-out" size={22} color="#E53E3E" />
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={styles.versionContainer}>
                  <MaterialCommunityIcons name="infinity" size={24} color="#3182CE" />
                  <Text style={styles.versionText}>App Version 0.0.1 </Text>
                </View>
              </View>

            </View>
          </SafeAreaView>
        </View>

        {/* Dimmed area — tap to close (kept separate so sidebar taps are not blocked) */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.background} />
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  background: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sidebarContainer: {
    width: width * 0.75,
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  nameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  viewProfileBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff5f5',
  },
  viewProfileText: {
    fontSize: 13,
    color: '#e60000',
    fontWeight: '600',
  },
  menuContainer: {
    paddingTop: 16,
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
    gap: 16,
  },
  menuText: {
    fontSize: 15,
    color: '#2D3748',
    fontWeight: '500',
  },
  footerSection: {
    paddingBottom: 24,
  },
  logoutText: {
    fontSize: 15,
    color: '#E53E3E',
    fontWeight: 'bold',
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A202C',
  },
});
