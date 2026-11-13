// Moves the app onto the UIScene life cycle, which the iOS 27 SDK requires:
// an app built with it that still makes its window in the app delegate is
// stopped by UIKit at launch. 1.9 (57) shipped that way and closed on opening
// for everyone on iOS 27 (2026-11-13).
//
// Expo 57's template has no scene delegate; Expo 58's does
// (`ExpoAppSceneDelegate`). Until the project moves to 58, this plugin:
// - copies plugins/scene/SceneDelegate.swift into the app and compiles it,
// - declares it in Info.plist's UIApplicationSceneManifest,
// - takes the window and React Native's start out of AppDelegate.swift.
// Each step leaves an already-converted project as it is.
/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads a config plugin with require, so this file is CommonJS. */
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const FILE = 'SceneDelegate.swift';

const WINDOW_IN_APP_DELEGATE =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

const MOVED = '// The window is made and React Native started by SceneDelegate (plugins/withSceneDelegate.js).';

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };

    return config;
  });
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withoutWindowInAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const source = config.modResults.contents;

    if (source.includes(MOVED)) {
      return config;
    }

    if (!WINDOW_IN_APP_DELEGATE.test(source)) {
      throw new Error(
        'withSceneDelegate: AppDelegate.swift no longer makes its window the way Expo 57 did; look at it before building.',
      );
    }

    config.modResults.contents = source.replace(WINDOW_IN_APP_DELEGATE, `    ${MOVED}\n`);

    return config;
  });
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withSceneDelegateFile(config) {
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const target = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName, FILE);

      fs.copyFileSync(path.join(__dirname, 'scene', FILE), target);

      return config;
    },
  ]);

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const name = config.modRequest.projectName;
    const filepath = `${name}/${FILE}`;

    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: name,
        project,
        targetUuid: project.findTargetKey(name),
      });
    }

    return config;
  });
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withSceneDelegate(config) {
  return withSceneDelegateFile(withoutWindowInAppDelegate(withSceneManifest(config)));
};
