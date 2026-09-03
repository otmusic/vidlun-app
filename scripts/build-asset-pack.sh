#!/usr/bin/env bash
# Builds the Apple-hosted asset pack that carries the speech model.
#
# The model itself is not in git — 668 MB of weights — so this fetches the
# exact file the app would otherwise download on the phone, then packages it
# with Xcode's tool. Upload the resulting .aar with Transporter (or
# `xcrun altool --upload-asset-pack`), and submit it for review together with
# the app version; a first pack has to ride with a version.
#
# Usage: scripts/build-asset-pack.sh
set -euo pipefail

PACK_DIR="$(cd "$(dirname "$0")/.." && pwd)/asset-packs/parakeet-tdt-06b-v3-q8"
MODEL_URL="https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin"
MODEL_FILE="$PACK_DIR/ggml-parakeet-tdt-0.6b-v3-q8_0.bin"
OUT="$PACK_DIR/../parakeet-tdt-06b-v3-q8.aar"

if [ ! -f "$MODEL_FILE" ]; then
  echo "Fetching the model into the pack directory..."
  curl -L --fail --progress-bar -o "$MODEL_FILE" "$MODEL_URL"
fi

SIZE=$(stat -f %z "$MODEL_FILE")
if [ "$SIZE" -lt 600000000 ]; then
  echo "Model file is only $SIZE bytes — not the weights. Delete it and retry." >&2
  exit 1
fi

echo "Packaging..."
xcrun ba-package "$PACK_DIR/Manifest.json" -o "$OUT"
echo "Asset pack written to $OUT"
