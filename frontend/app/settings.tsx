import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/utils/api';
import { performLogout } from '@/utils/session';
import { AppUI } from '@/constants/theme';
import { getNavBarTopPadding } from '@/utils/safeAreaInsets';

type DeletionStatus = {
  deletionPending: boolean;
  deletionRequestedAt: string | null;
  scheduledDeletionAt: string | null;
  gracePeriodDays: number;
};

function SettingsHeader({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const navTopPadding = getNavBarTopPadding(insets);

  return (
    <View style={[styles.header, { paddingTop: Math.max(navTopPadding - 4, 0) }]}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Feather name="arrow-left" size={24} color={AppUI.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Settings</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    loadDeletionStatus();
  }, []);

  const loadDeletionStatus = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/app/user/deletion-status', {
        method: 'GET',
      });
      setDeletionStatus(response.data);
    } catch (error) {
      console.error('Failed to load deletion status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteAccount = () => {
    // Step 1: Show initial warning
    Alert.alert(
      'Delete Account',
      `Your account will be scheduled for permanent deletion after 7 days.\n\nDuring this period, you can recover your account by simply logging in again.\n\nIf you do not log in within 7 days, your account and all associated data will be permanently deleted.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: showConfirmation,
        },
      ]
    );
  };

  const showConfirmation = () => {
    // Step 2: Require explicit confirmation
    Alert.alert(
      'Are you absolutely sure?',
      'This action cannot be undone immediately. You will be logged out and your account will be scheduled for deletion.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, I want to delete my account',
          style: 'destructive',
          onPress: requestDeletion,
        },
      ]
    );
  };

  const requestDeletion = async () => {
    try {
      setDeletingAccount(true);
      
      // Step 3: Schedule deletion and logout
      const response = await apiFetch('/api/app/user/request-deletion', {
        method: 'POST',
      });

      const { scheduledDeletionAt } = response.data;
      const deletionDate = formatDate(scheduledDeletionAt);

      // Show confirmation message
      Alert.alert(
        'Account Deletion Scheduled',
        `Your account is scheduled for permanent deletion on ${deletionDate}.\n\nYou can recover it by logging in again before this date.`,
        [
          {
            text: 'OK',
            onPress: async () => {
              // Logout and redirect
              await performLogout();
              router.replace('/intro');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.error('Failed to request deletion:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to schedule account deletion. Please try again.'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SettingsHeader onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppUI.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SettingsHeader onBack={() => router.back()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="user-x" size={20} color={AppUI.accent} />
              <Text style={styles.cardTitle}>Delete Account</Text>
            </View>

            {deletionStatus?.deletionPending ? (
              <View style={styles.warningBox}>
                <Feather name="alert-triangle" size={20} color="#FF6B00" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle} numberOfLines={1}>
                    Account deletion scheduled
                  </Text>
                  <Text style={styles.warningText} numberOfLines={1}>
                    Permanent deletion: {formatDate(deletionStatus.scheduledDeletionAt!)}
                  </Text>
                  <Text style={styles.warningText} numberOfLines={1}>
                    Log in again before this date to cancel.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.cardDescription} numberOfLines={1}>
                  Permanently delete your account and data.
                </Text>
                <Text style={styles.cardNote} numberOfLines={1}>
                  • 7-day grace period to recover your account
                </Text>
                <Text style={styles.cardNote} numberOfLines={1}>
                  • Log in again within 7 days to cancel
                </Text>
                <Text style={[styles.cardNote, styles.cardNoteLast]} numberOfLines={1}>
                  • After 7 days, deletion is permanent
                </Text>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="trash-2" size={18} color="#FFFFFF" />
                      <Text style={styles.deleteButtonText} numberOfLines={1}>
                        Delete My Account
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>
          <View style={styles.card}>
            <Text style={styles.cardDescription}>
              For security and privacy settings, please visit the main menu or contact support.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: AppUI.text,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: AppUI.bg,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppUI.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: AppUI.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppUI.divider,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: AppUI.text,
  },
  cardDescription: {
    fontSize: 15,
    color: AppUI.textSecondary,
    marginBottom: 12,
  },
  cardNote: {
    fontSize: 14,
    color: AppUI.textTertiary,
    marginBottom: 6,
  },
  cardNoteLast: {
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: AppUI.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#FFF5E6',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFD699',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CC5500',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#996600',
    marginBottom: 6,
  },
});
