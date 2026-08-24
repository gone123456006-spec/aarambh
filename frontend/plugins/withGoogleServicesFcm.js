const { withAppBuildGradle, withProjectBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

const GMS_CLASSPATH = "classpath('com.google.gms:google-services:4.4.2')";
const GMS_PLUGIN = "apply plugin: 'com.google.gms.google-services'";

function withGoogleServicesFcm(config) {
  config = withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('com.google.gms:google-services')) {
      contents = contents.replace(
        /classpath\('org.jetbrains.kotlin:kotlin-gradle-plugin'\)/,
        `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')\n    ${GMS_CLASSPATH}`
      );
      config.modResults.contents = contents;
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("com.google.gms.google-services")) {
      contents = `${contents.trimEnd()}\n\n${GMS_PLUGIN}\n`;
      config.modResults.contents = contents;
    }
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const usesPermissions = manifest['uses-permission'] || [];
    const hasPost = usesPermissions.some(
      (p) => p.$?.['android:name'] === 'android.permission.POST_NOTIFICATIONS'
    );
    if (!hasPost) {
      usesPermissions.push({
        $: { 'android:name': 'android.permission.POST_NOTIFICATIONS' },
      });
      manifest['uses-permission'] = usesPermissions;
    }

    const application = manifest.application?.[0];
    if (application) {
      application['meta-data'] = application['meta-data'] || [];
      const hasChannel = application['meta-data'].some(
        (m) => m.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id'
      );
      if (!hasChannel) {
        application['meta-data'].push({
          $: {
            'android:name': 'com.google.firebase.messaging.default_notification_channel_id',
            'android:value': 'default',
          },
        });
      }
    }
    return config;
  });

  return config;
}

module.exports = withGoogleServicesFcm;
