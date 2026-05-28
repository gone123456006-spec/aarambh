import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import LegalPageLayout, { legalStyles } from '@/components/LegalPageLayout';
import { APP_INFO, phoneTelUri, whatsappUri } from '@/constants/appInfo';
import { AppUI } from '@/constants/theme';

const ROW_ICON = { strokeWidth: 3 };

type ContactRowProps = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
};

function ContactRow({ icon, label, value, onPress, isLast }: ContactRowProps) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
        <Feather name={icon} size={22} color={AppUI.text} {...ROW_ICON} />
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={AppUI.textTertiary} strokeWidth={2} />
      </TouchableOpacity>
      {!isLast ? <View style={legalStyles.divider} /> : null}
    </>
  );
}

export default function ContactUsScreen() {
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
          isLast
        />
      </View>

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
  rowValue: {
    fontSize: 16,
    fontWeight: '400',
    color: AppUI.text,
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
