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
