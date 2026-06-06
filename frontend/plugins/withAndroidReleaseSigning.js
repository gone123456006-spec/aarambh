const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = 'OHMS_RELEASE_SIGNING';

/**
 * Release builds use frontend/keystore.properties + ohms-upload-key.keystore (gitignored).
 */
function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      return config;
    }

    if (!contents.includes('keystorePropertiesFile')) {
      contents = contents.replace(
        'android {',
        `def keystorePropertiesFile = rootProject.file("../keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {`
      );
    }

    if (!contents.includes('signingConfigs.release')) {
      contents = contents.replace(
        /(\s+)signingConfigs \{\s*\n\s+debug \{[\s\S]*?\n\s+\}\s*\n\s+\}/,
        `$1signingConfigs {
$1    debug {
$1        storeFile file('debug.keystore')
$1        storePassword 'android'
$1        keyAlias 'androiddebugkey'
$1        keyPassword 'android'
$1    }
$1    release {
$1        if (keystorePropertiesFile.exists()) {
$1            keyAlias keystoreProperties['keyAlias']
$1            keyPassword keystoreProperties['keyPassword']
$1            storeFile file("\${rootProject.projectDir}/../\${keystoreProperties['storeFile']}")
$1            storePassword keystoreProperties['storePassword']
$1        }
$1    }
$1}`
      );
    }

    contents = contents.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig signingConfigs.release // ${MARKER}`
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAndroidReleaseSigning;
