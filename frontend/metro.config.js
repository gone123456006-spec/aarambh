// Metro configuration for Expo SDK 54+
// https://docs.expo.dev/guides/customizing-metro/

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Compile modern JS (e.g. class private fields) for Hermes — fixes export/APK bundle errors
config.transformer.hermesParser = true;

module.exports = config;

