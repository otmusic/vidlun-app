#!/usr/bin/env bash
# Everything `expo prebuild --platform ios` wipes and cannot be told about.
#
# Run it after every prebuild, before pods. The launch screen lives in the
# generated project as a named colour, an appearance-aware imageset and a
# patched storyboard — none of which app.json can express — and the
# downloader target needs two build settings the targets plugin hardcodes
# wrong for it. Each step prints what it did so a silent miss shows.
set -euo pipefail

cd "$(dirname "$0")/.."

sh scripts/generate-splash-assets.sh
bash scripts/fix-downloader-target.sh

# The widget uses no app group, but the targets plugin writes the key into its
# entitlements whenever the app has one (an empty list when the target config
# says so). A team profile without the App Groups capability refuses to sign
# an entitlements file that so much as mentions the key, so it goes.
# (plistlib rather than plutil: plutil reads the dots in the key as a path.)
WIDGET_ENTITLEMENTS=ios/.targets/widget/generated.entitlements
python3 - "$WIDGET_ENTITLEMENTS" <<'PY'
import plistlib, sys
path = sys.argv[1]
with open(path, 'rb') as handle:
    entitlements = plistlib.load(handle)
entitlements.pop('com.apple.security.application-groups', None)
with open(path, 'wb') as handle:
    plistlib.dump(entitlements, handle)
PY
echo "widget app groups: $(grep -c application-groups "$WIDGET_ENTITLEMENTS") (expect 0)"
