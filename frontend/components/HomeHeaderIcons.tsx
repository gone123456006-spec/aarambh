import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppUI } from '@/constants/theme';

/** Samsung-style hamburger — three equal lines */
export function HomeMenuIcon() {
  return (
    <View style={menuStyles.wrap}>
      <View style={menuStyles.bar} />
      <View style={menuStyles.bar} />
      <View style={menuStyles.bar} />
    </View>
  );
}

const menuStyles = StyleSheet.create({
  wrap: {
    width: 24,
    height: 16,
    justifyContent: 'space-between',
  },
  bar: {
    width: 24,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: AppUI.text,
  },
});
