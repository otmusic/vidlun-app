// Puts the speech model into the app bundle as a plain resource.
//
// The file is 669 MB, which rules out the two ways assets usually travel:
// Metro would try to hash and bundle it, and expo-asset would copy it at
// runtime. A resource in the Xcode project is copied by the build and read
// in place by whisper.rn, the way the fonts go in — the same call expo-font
// makes for them.
//
// The file is not in git (see .gitignore); `scripts/fetch-model.sh` brings
// it. A release build without it would be a voice journal that cannot hear,
// so the plugin refuses rather than warns.
/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads a config plugin with require, so this file is CommonJS. */
const fs = require('fs');
const path = require('path');
const { IOSConfig, withXcodeProject } = require('expo/config-plugins');

/** @type {import('expo/config-plugins').ConfigPlugin<{ file: string }>} */
module.exports = function withBundledModel(config, { file }) {
  return withXcodeProject(config, (config) => {
    const absolute = path.resolve(config.modRequest.projectRoot, file);

    if (!fs.existsSync(absolute)) {
      throw new Error(
        `The speech model is not at ${file}. Run scripts/fetch-model.sh before prebuild.`,
      );
    }

    const project = config.modResults;

    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: path.relative(config.modRequest.platformProjectRoot, absolute),
      groupName: 'Resources',
      project,
      isBuildFile: true,
      verbose: true,
    });

    return config;
  });
};
