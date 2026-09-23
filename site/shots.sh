#!/bin/zsh
# Turns the simulator screenshots into the landing page's images: AVIF at
# 640 and 960 px wide (the page's own; the browser picks by pixel density)
# and a 640 px JPEG (the fallback), from PNGs at 1206 x 2622, into
# site/shots (tracked; the build copies them to legal/site).
# Usage: site/shots.sh <folder with <lang>-<screen>-<theme>.png>
set -e
SRC="$1"
OUT="$(dirname "$0")/shots"
TMP="$(mktemp -d)"
mkdir -p "$OUT"
rm -f "$OUT"/*.avif "$OUT"/*.jpg
for png in "$SRC"/*.png; do
  name="$(basename "$png" .png)"
  for w in 640 960; do
    sips --resampleWidth "$w" "$png" --out "$TMP/$name-$w.png" >/dev/null 2>&1
    ffmpeg -hide_banner -loglevel error -y -i "$TMP/$name-$w.png" -c:v libsvtav1 -crf 16 -preset 4 -pix_fmt yuv444p -frames:v 1 -f avif "$OUT/$name-$w.avif"
  done
  sips -s format jpeg -s formatOptions 86 "$TMP/$name-640.png" --out "$OUT/$name-640.jpg" >/dev/null 2>&1
done
rm -rf "$TMP"
du -sh "$OUT"; ls "$OUT" | wc -l
