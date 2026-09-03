#!/usr/bin/env bash
# Run after every `expo prebuild --platform ios`.
#
# The downloader extension is declared with the plugin's `app-intent` type —
# the only one it builds as an ExtensionKit extension, which the App Store
# requires for a Background Assets downloader. That type's configuration list
# hardcodes two settings the plugin ignores our config for: a deployment
# target of 17.0 (the extension uses iOS 26-only API) and a build version of
# 1 (an embedded extension must carry the app's own CFBundleVersion, or the
# upload is rejected). Both are put right here, and the counts are printed so
# a silent miss shows.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBX="$ROOT/ios/Vidlun.xcodeproj/project.pbxproj"
BUILD_NUMBER=$(node -e "console.log(require('$ROOT/app.json').expo.ios.buildNumber)")

sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = 17.0;/IPHONEOS_DEPLOYMENT_TARGET = 26.0;/g' "$PBX"
sed -i '' -E "s/CURRENT_PROJECT_VERSION = \"?[0-9]+\"?;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" "$PBX"

echo "deployment 26.0: $(grep -c 'IPHONEOS_DEPLOYMENT_TARGET = 26.0' "$PBX") (expect 2)"
echo "version $BUILD_NUMBER: $(grep -c "CURRENT_PROJECT_VERSION = $BUILD_NUMBER;" "$PBX") (expect 4)"
