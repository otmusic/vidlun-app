#!/usr/bin/env bash
# Everything `expo prebuild --platform ios` wipes and cannot be told about.
#
# Run it after every prebuild, before pods. The launch screen lives in the
# generated project as a named colour, an appearance-aware imageset and a
# patched storyboard — none of which app.json can express — and every
# target has to carry the app's build number. Each step prints what it did
# so a silent miss shows.
set -euo pipefail

cd "$(dirname "$0")/.."

sh scripts/generate-splash-assets.sh

# Every target must carry the app's own CFBundleVersion — an embedded
# extension with a different one is rejected at upload — and the targets
# plugin gives the widget its own number. Written straight into the project,
# so the counts printed here should match the number of build configurations.
BUILD_NUMBER=$(node -e "console.log(require('./app.json').expo.ios.buildNumber)")
PBX=ios/Vidlun.xcodeproj/project.pbxproj
sed -i '' -E "s/CURRENT_PROJECT_VERSION = \"?[0-9]+\"?;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" "$PBX"
echo "build number $BUILD_NUMBER in $(grep -c "CURRENT_PROJECT_VERSION = $BUILD_NUMBER;" "$PBX") configurations"
