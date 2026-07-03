const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = 'CMAKE_OBJECT_PATH_MAX';
const ROOT_MARKER = 'OHMS_WINDOWS_NATIVE_SUBPROJECTS';

const ROOT_SUBPROJECTS_BLOCK = `

// ${ROOT_MARKER}: CMake path limits for all native library modules on Windows
def isWindowsBuild = System.getProperty('os.name').toLowerCase().contains('windows')

subprojects { subproject ->
    subproject.plugins.withId('com.android.library') {
        subproject.android {
            if (isWindowsBuild) {
                defaultConfig {
                    externalNativeBuild {
                        cmake {
                            def shortNinja = new File('C:/ninja/ninja.exe')
                            if (shortNinja.exists()) {
                                arguments '-DCMAKE_MAKE_PROGRAM=' + shortNinja.absolutePath.replace('\\\\', '/')
                            }
                            arguments '-DCMAKE_OBJECT_PATH_MAX=1024'
                        }
                    }
                }
            }
        }
    }
}
`;

const WINDOWS_CMAKE_BLOCK = `
        if (isWindows) {
            externalNativeBuild {
                cmake {
                    def cmakeRoot = new File("\${android.sdkDirectory}/cmake")
                    def cmakeVersionDir = cmakeRoot.exists()
                        ? cmakeRoot.listFiles()?.findAll { it.isDirectory() }?.max { it.name }
                        : null
                    def cmakeBin = (cmakeVersionDir != null
                        ? new File(cmakeVersionDir, "bin")
                        : new File(cmakeRoot, "3.22.1/bin")).absolutePath.replace("\\\\", "/")
                    def shortNinja = new File("C:/ninja/ninja.exe")
                    def ninjaPath = shortNinja.exists()
                        ? shortNinja.absolutePath.replace("\\\\", "/")
                        : "\${cmakeBin}/ninja.exe"
                    arguments "-DCMAKE_MAKE_PROGRAM=\${ninjaPath}",
                        "-DCMAKE_OBJECT_PATH_MAX=1024"
                }
            }
        }`;

/**
 * Windows: Ninja in Android SDK CMake (<1.12) hits MAX_PATH (260) on deep RN codegen paths.
 * @see https://kirillzyusko.github.io/react-native-keyboard-controller/docs/troubleshooting
 */
function withAndroidWindowsLongPaths(config) {
  config = withProjectBuildGradle(config, (config) => {
    let root = config.modResults.contents;
    if (!root.includes(ROOT_MARKER)) {
      root += ROOT_SUBPROJECTS_BLOCK;
      config.modResults.contents = root;
    }
    return config;
  });

  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("def isWindows =")) {
      contents = contents.replace(
        /def jscFlavor = [^\n]+\n\nandroid \{/,
        (match) => match.replace('\n\nandroid {', "\n\ndef isWindows = System.getProperty('os.name').toLowerCase().contains('windows')\n\nandroid {"),
      );
    }

    // Remove legacy Ant import if present from older prebuilds
    contents = contents.replace(
      /^import org\.apache\.tools\.ant\.taskdefs\.condition\.Os\n\n/m,
      '',
    );
    contents = contents.replace(
      /if \(Os\.isFamily\(Os\.FAMILY_WINDOWS\)\)/g,
      'if (isWindows)',
    );

    if (!contents.includes(MARKER)) {
      const match = contents.match(/defaultConfig\s*\{([\s\S]*?)\n    \}/);
      if (match) {
        contents = contents.replace(
          /defaultConfig\s*\{([\s\S]*?)\n    \}/,
          `defaultConfig {${match[1]}${WINDOWS_CMAKE_BLOCK}\n    }`,
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAndroidWindowsLongPaths;
