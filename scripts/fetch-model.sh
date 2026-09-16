#!/usr/bin/env bash
# Brings the speech model the build bundles, from the same public file the
# app used to download at runtime. Run once before `expo prebuild`; the
# config plugin refuses to build without it. The file stays out of git.
set -euo pipefail

cd "$(dirname "$0")/.."

FILE=ggml-parakeet-tdt-0.6b-v3-q4_k.bin
URL="https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/$FILE"
DEST="assets/model/$FILE"
SIZE=415611879
SHA256=8b205b8b39c6535e153de6fb11c51db46125d45c4f16ba496fe41a0fe71b885e

check() {
  [ -f "$DEST" ] || return 1
  [ "$(stat -f %z "$DEST")" = "$SIZE" ] || return 1
  [ "$(shasum -a 256 "$DEST" | cut -d' ' -f1)" = "$SHA256" ] || return 1
}

if check; then
  echo "model in place: $DEST"
  exit 0
fi

mkdir -p assets/model
echo "fetching $FILE (416 MB)…"
curl -L --fail --progress-bar -o "$DEST.part" "$URL"
mv "$DEST.part" "$DEST"

if ! check; then
  echo "downloaded file does not match the expected size or checksum" >&2
  exit 1
fi

echo "model in place: $DEST"
