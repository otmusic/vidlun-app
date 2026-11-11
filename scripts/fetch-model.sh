#!/usr/bin/env bash
# Makes the speech model the build bundles: Moondream's Parakeet Ultra in
# whisper.rn's ggml layout, quantised to 4 bits (BACKLOG §1d⁗). Nobody hosts
# this file, so it is made here from pinned inputs, and the result is checked
# against the size and checksum the shipped one has. Run once before
# `expo prebuild`; the config plugin refuses to build without it. The files
# stay out of git.
#
# Making it needs python3 with numpy and safetensors (a venv will do) and
# `parakeet-quantize` from whisper.cpp v1.9.1, the version whisper.rn carries:
#
#   git clone --depth 1 --branch v1.9.1 https://github.com/ggml-org/whisper.cpp
#   cmake -B whisper.cpp/build -S whisper.cpp -DCMAKE_BUILD_TYPE=Release
#   cmake --build whisper.cpp/build --target parakeet-quantize -j 8
#   PARAKEET_QUANTIZE=whisper.cpp/build/bin/parakeet-quantize \
#     PYTHON=venv/bin/python scripts/fetch-model.sh
set -euo pipefail

cd "$(dirname "$0")/.."

DIR=assets/model
FILE=ggml-parakeet-ultra-0.6b-q4_0.bin
SIZE=355615679
SHA256=e7d2561b02f228e010f5b251faab7e7ff5d45980136c542dbacb6e55c0abd49f

# v3, whose header and tensor list the conversion follows (and the model
# 1.0 to 1.9 shipped).
TEMPLATE=ggml-parakeet-tdt-0.6b-v3-q8_0.bin
TEMPLATE_URL="https://huggingface.co/ggml-org/parakeet-GGUF/resolve/35156454d1a39de06863303dd209fd2bed6ee079/$TEMPLATE"
TEMPLATE_SIZE=668757119
TEMPLATE_SHA256=4d64e9e96c2792186d072fde0034df0ad670cf680a2f53069052ead827fd600e

ULTRA_URL="https://huggingface.co/moondream/parakeet-ultra/resolve/73175eb7aeb0d82f1e2a6b53b3aabc10a90bcd0b"
ULTRA_DIR="$DIR/parakeet-ultra"
ULTRA_FILES=(
  "model.safetensors 1255353386 c9608f36d0ab956c14bfcc525479b0746b3b42a56f6949ec85c14eb7466717dc"
  "tokenizer.json 1159960 bd321b096832a3f270bd3b2a88823957920f1a5c5ada71114a26ea729d0cbe91"
)

matches() {
  [ -f "$1" ] || return 1
  [ "$(stat -f %z "$1")" = "$2" ] || return 1
  [ "$(shasum -a 256 "$1" | cut -d' ' -f1)" = "$3" ] || return 1
}

fetch() {
  local url=$1 dest=$2 size=$3 sha=$4
  if matches "$dest" "$size" "$sha"; then
    return 0
  fi
  echo "fetching $(basename "$dest")…"
  curl -L --fail --progress-bar -o "$dest.part" "$url"
  mv "$dest.part" "$dest"
  if ! matches "$dest" "$size" "$sha"; then
    echo "$dest does not match the expected size or checksum" >&2
    exit 1
  fi
}

if matches "$DIR/$FILE" "$SIZE" "$SHA256"; then
  echo "model in place: $DIR/$FILE"
  exit 0
fi

PYTHON=${PYTHON:-python3}
if ! "$PYTHON" -c 'import numpy, safetensors' 2>/dev/null; then
  echo "$PYTHON lacks numpy or safetensors; see the top of this script" >&2
  exit 1
fi
if [ ! -x "${PARAKEET_QUANTIZE:-}" ]; then
  echo "PARAKEET_QUANTIZE must point at whisper.cpp v1.9.1's parakeet-quantize; see the top of this script" >&2
  exit 1
fi

mkdir -p "$ULTRA_DIR"
fetch "$TEMPLATE_URL" "$DIR/$TEMPLATE" "$TEMPLATE_SIZE" "$TEMPLATE_SHA256"
for entry in "${ULTRA_FILES[@]}"; do
  read -r name size sha <<< "$entry"
  fetch "$ULTRA_URL/$name" "$ULTRA_DIR/$name" "$size" "$sha"
done

F32="$DIR/ggml-parakeet-ultra-0.6b-f32.bin"
trap 'rm -f "$F32"' EXIT
"$PYTHON" scripts/convert-parakeet-ultra.py --template "$DIR/$TEMPLATE" --ultra "$ULTRA_DIR" --out "$F32"
"$PARAKEET_QUANTIZE" "$F32" "$DIR/$FILE.part" q4_0 > /dev/null
mv "$DIR/$FILE.part" "$DIR/$FILE"

if ! matches "$DIR/$FILE" "$SIZE" "$SHA256"; then
  echo "the model made here does not match the one the app ships; check the whisper.cpp version" >&2
  exit 1
fi

echo "model in place: $DIR/$FILE"
