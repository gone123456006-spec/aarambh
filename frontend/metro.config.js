// Metro configuration for Expo SDK 54+
// https://docs.expo.dev/guides/customizing-metro/

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  ...Array.from(config.resolver.blockList || []),
  /.*android\/\.cxx.*/,
];

module.exports = config;
