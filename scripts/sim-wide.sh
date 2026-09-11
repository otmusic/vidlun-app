#!/usr/bin/env bash
# A simulator build that runs as a universal app with landscape allowed, so
# the iPad mini simulator (1133x744) can stand in for the iPhone Duo inner
# display until Xcode 27.1 brings the real one. Also copies the journal state
# from an iPhone 17 Pro simulator that has one, so the screens have entries.
# The Info.plist edit is undone on exit; nothing here touches the release build.
#
#   OUT=/path/for/derived-data bash scripts/sim-wide.sh
set -uo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT:-${TMPDIR:-/tmp}/vidlun-sim-wide}"
mkdir -p "$OUT"
PLIST=ios/Vidlun/Info.plist
PB=/usr/libexec/PlistBuddy
cp "$PLIST" "$OUT/Info.plist.orig"
restore() { cp "$OUT/Info.plist.orig" "$PLIST" && echo "plist restored: $($PB -c 'Print :UISupportedInterfaceOrientations' "$PLIST" | tr -s ' \n' ' ')"; }
trap restore EXIT
$PB -c 'Add :UISupportedInterfaceOrientations: string UIInterfaceOrientationLandscapeLeft' \
    -c 'Add :UISupportedInterfaceOrientations: string UIInterfaceOrientationLandscapeRight' "$PLIST"
$PB -c 'Add :UISupportedInterfaceOrientations~ipad array' \
    -c 'Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationPortrait' \
    -c 'Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationLandscapeLeft' \
    -c 'Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationLandscapeRight' "$PLIST"
echo "test-build orientations: $($PB -c 'Print :UISupportedInterfaceOrientations' "$PLIST" | tr -s ' \n' ' ')"
WS=$(ls -d ios/*.xcworkspace | head -1); SCHEME=$(basename "$WS" .xcworkspace)
echo "workspace: $WS scheme: $SCHEME"
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath "$OUT/derived" \
  TARGETED_DEVICE_FAMILY="1,2" CODE_SIGNING_ALLOWED=NO build > "$OUT/build.log" 2>&1
echo "build exit: $?"
grep -E "error:|BUILD (SUCCEEDED|FAILED)" "$OUT/build.log" | tail -8
restore; trap - EXIT
APP=$(ls -d "$OUT"/derived/Build/Products/Release-iphonesimulator/*.app 2>/dev/null | head -1)
[ -n "$APP" ] && [ -f "$APP/Info.plist" ] || { echo "no app built"; exit 1; }
echo "device family in built app: $($PB -c 'Print :UIDeviceFamily' "$APP/Info.plist" | tr -s ' \n' ' ')"
read -r IPAD SRC <<<"$(python3 - <<'PY'
import json, subprocess
data = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', '--json']))
devs = data['devices'].get('com.apple.CoreSimulator.SimRuntime.iOS-26-5', [])
ipad = next((d['udid'] for d in devs if d['name'] == 'iPad mini (A17 Pro)' and d.get('isAvailable')), '')
src = ''
for d in devs:
    if d['name'] != 'iPhone 17 Pro' or not d.get('isAvailable'):
        continue
    try:
        c = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', d['udid'], 'com.vidlun.journal', 'data'], stderr=subprocess.DEVNULL).decode().strip()
    except subprocess.CalledProcessError:
        continue
    found = subprocess.run(['find', c, '-maxdepth', '5', '-name', 'RCTAsyncLocalStorage*'], capture_output=True, text=True).stdout.strip()
    if found:
        src = d['udid']
        break
print(ipad, src)
PY
)"
echo "ipad: $IPAD  seed source: ${SRC:-none}"
xcrun simctl boot "$IPAD" 2>/dev/null; xcrun simctl bootstatus "$IPAD" -b >/dev/null 2>&1
xcrun simctl install "$IPAD" "$APP" && echo "installed on iPad mini"
if [ -n "$SRC" ]; then
  S=$(xcrun simctl get_app_container "$SRC" com.vidlun.journal data) || S=""
  D=$(xcrun simctl get_app_container "$IPAD" com.vidlun.journal data) || D=""
  if [ -d "$S" ] && [ -d "$D" ] && [ "$D" != "/" ]; then
    rsync -a "$S/Library/" "$D/Library/" && rsync -a "$S/Documents/" "$D/Documents/" && echo "state seeded from 17 Pro"
  else
    echo "seed skipped (source: ${S:-none}, destination: ${D:-none})"
  fi
fi
xcrun simctl launch "$IPAD" com.vidlun.journal && echo "launched"
