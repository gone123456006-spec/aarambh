import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO, phoneTelUri, whatsappUri } from '@/constants/appInfo';
import { PLAY_STORE_URLS } from '@/constants/playStore';
import { AppUI } from '@/constants/theme';
import { deleteMyAccount } from '@/utils/authApi';
import { performLogout } from '@/utils/session';

const ROW_ICON = { strokeWidth: 3 };

type ContactRowProps = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
};

function ContactRow({ icon, label, value, onPress, danger, isLast }: ContactRowProps) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
        <Feather
          name={icon}
          size={22}
          color={danger ? AppUI.accent : AppUI.text}
          {...ROW_ICON}
        />
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
          <Text style={[styles.rowValue, danger && styles.rowValueDanger]}>{value}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={AppUI.textTertiary} strokeWidth={2} />
      </TouchableOpacity>
      {!isLast ? <View style={legalStyles.divider} /> : null}
    </>
  );
}

export default function ContactUsScreen() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const openUrl = useCallback(async (url: string, failMsg: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert('Unable to open', failMsg);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open', failMsg);
    }
  }, []);

  const callMobile = () => openUrl(phoneTelUri(), 'Could not open the phone dialer.');

  const openWhatsApp = () =>
    openUrl(whatsappUri(), 'Could not open WhatsApp. Make sure it is installed.');

  const openEmail = () =>
    openUrl(
      `mailto:${APP_INFO.email}?subject=${encodeURIComponent(`${APP_INFO.appName} App Support`)}`,
      'Could not open your email app.'
    );

  const openPrivacyWeb = () =>
    openUrl(PLAY_STORE_URLS.privacyPolicy, 'Could not open the privacy policy page.');

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, progress, chat history, and rewards. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await deleteMyAccount();
                await performLogout();
                router.replace('/intro');
              } catch {
                Alert.alert(
                  'Could not delete account',
                  `Sign in and try again, or email ${APP_INFO.email} from your registered Gmail.`
                );
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <LegalPageLayout
      title="Contact Us"
      subtitle="Monday–Saturday, 10:00 AM – 6:00 PM IST"
    >
      <Text style={[legalStyles.body, styles.intro]}>
        Reach {APP_INFO.companyName} using any option below. For account or OTP issues, email from
        the same address you use to sign in.
      </Text>

      <View style={styles.list}>
        <ContactRow
          icon="phone"
          label="Mobile"
          value={`+91 ${APP_INFO.mobile}`}
          onPress={callMobile}
        />
        <ContactRow
          icon="message-circle"
          label="WhatsApp"
          value={`+91 ${APP_INFO.whatsapp}`}
          onPress={openWhatsApp}
        />
        <ContactRow
          icon="mail"
          label="Email"
          value={APP_INFO.email}
          onPress={openEmail}
        />
        <ContactRow
          icon="shield"
          label="Privacy policy (web)"
          value="aarambh-api.onrender.com/privacy-policy"
          onPress={openPrivacyWeb}
          isLast
        />
      </View>

      <TouchableOpacity
        style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
        onPress={confirmDeleteAccount}
        disabled={deleting}
        activeOpacity={0.7}
      >
        {deleting ? (
          <ActivityIndicator color={AppUI.accent} />
        ) : (
          <>
            <Feather name="trash-2" size={18} color={AppUI.accent} strokeWidth={2.5} />
            <Text style={styles.deleteBtnText}>Delete my account</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.noteBox}>
        <Feather name="info" size={20} color={AppUI.textSecondary} strokeWidth={2.5} />
        <Text style={styles.noteText}>
          For random chat safety concerns, include screenshots when possible. We do not ask for
          passwords or OTP codes over phone or chat.
        </Text>
      </View>
    </LegalPageLayout>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: 16,
  },
  list: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    minHeight: 52,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: AppUI.textTertiary,
    marginBottom: 2,
  },
  rowLabelDanger: {
    color: AppUI.accent,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '400',
    color: AppUI.text,
  },
  rowValueDanger: {
    color: AppUI.accent,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AppUI.accent,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  deleteBtnDisabled: {
    opacity: 0.6,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppUI.accent,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: AppUI.bg,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: AppUI.textSecondary,
    fontWeight: '400',
  },
});
