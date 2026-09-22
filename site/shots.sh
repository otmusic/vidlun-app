#!/bin/zsh
# Turns the simulator screenshots into the landing page's images:
# 640 px wide AVIF (the page's own) and JPEG (the fallback), from PNGs at
# 1206 x 2622, into site/shots (tracked; the build copies them to legal/site). Usage: site/shots.sh <folder with <lang>-<screen>-<theme>.png>
set -e
SRC="$1"
OUT="$(dirname "$0")/shots"
mkdir -p "$OUT"
for png in "$SRC"/*.png; do
  name="$(basename "$png" .png)"
  sips -Z 640 "$png" --out "/tmp/$name-640.png" >/dev/null 2>&1
  ffmpeg -hide_banner -loglevel error -y -i "/tmp/$name-640.png" -c:v libsvtav1 -crf 22 -preset 4 -pix_fmt yuv444p -frames:v 1 -f avif "$OUT/$name.avif"
  sips -s format jpeg -s formatOptions 84 "/tmp/$name-640.png" --out "$OUT/$name.jpg" >/dev/null 2>&1
  rm -f "/tmp/$name-640.png"
done
du -sh "$OUT"; ls "$OUT" | wc -l
