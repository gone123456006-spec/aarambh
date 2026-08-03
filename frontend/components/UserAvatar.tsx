import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppUI } from '@/constants/theme';
import { resolveMediaUrl } from '@/utils/mediaUrl';

type Props = {
  name?: string;
  avatar?: string | null;
  size?: number;
  highlighted?: boolean;
  style?: ViewStyle;
  backgroundColor?: string;
};

export default function UserAvatar({
  name,
  avatar,
  size = 40,
  highlighted,
  style,
  backgroundColor,
}: Props) {
  const radius = size / 2;
  const letter = (name?.trim()?.charAt(0) || '?').toUpperCase();
  const uri = resolveMediaUrl(avatar);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
          highlighted && styles.highlighted,
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: backgroundColor || (highlighted ? AppUI.accent : '#CBD5E1'),
        },
        highlighted && styles.fallbackMe,
        style,
      ]}
    >
      {size >= 28 ? (
        <Ionicons name="person" size={Math.round(size * 0.48)} color="#FFFFFF" />
      ) : (
        <Text style={[styles.letter, { fontSize: Math.round(size * 0.42) }]}>{letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: AppUI.surfaceMuted,
  },
  highlighted: {
    borderWidth: 2,
    borderColor: AppUI.accent,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackMe: {
    borderWidth: 2,
    borderColor: AppUI.accent,
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
