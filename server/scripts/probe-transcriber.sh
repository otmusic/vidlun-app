#!/usr/bin/env bash
#
# Checks the deployed transcriber from a terminal, where there is no App
# Attest. A throwaway key is made here, set as the TRANSCRIBE_PROBE_KEY
# secret, used for the takes given, and deleted again however the run ends,
# so the probe door is open only while this script runs. The key is never
# printed or written to a file.
#
#   server/scripts/probe-transcriber.sh take.wav [more.wav …]
#
# Each take is sent twice: the first can include the container waking up,
# the second is the wait a person would see with it already warm.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -eq 0 ]; then
  echo "usage: $0 take.wav [more.wav …]" >&2
  exit 64
fi

URL="${URL:-https://vidlun-proxy.vidlun.workers.dev/v1/transcribe}"
KEY="$(openssl rand -hex 32)"

# Everything printed below also lands in this file (never the key), so the
# run can be read afterwards from wherever it was started.
RESULTS="${TMPDIR:-/tmp}/vidlun-probe-results.txt"
exec > >(tee "$RESULTS") 2>&1
echo "Probe of $URL at $(date '+%Y-%m-%d %H:%M:%S')"

close_door() {
  echo
  echo "Deleting TRANSCRIBE_PROBE_KEY…"
  npx wrangler secret delete TRANSCRIBE_PROBE_KEY < /dev/null > /dev/null 2>&1 \
    && echo "Deleted." \
    || echo "Could not delete it: run 'npx wrangler secret delete TRANSCRIBE_PROBE_KEY' in server/."
  echo "Saved to $RESULTS"
}
trap close_door EXIT

echo "Setting TRANSCRIBE_PROBE_KEY…"
printf '%s' "$KEY" | npx wrangler secret put TRANSCRIBE_PROBE_KEY > /dev/null
# A secret reaches the edge within seconds, not at once.
sleep 8

for file in "$@"; do
  for run in 1 2; do
    reply="$(mktemp)"
    timing="$(curl -sS -o "$reply" -w '%{http_code} %{time_total}' \
      -H "x-probe-key: $KEY" -H 'content-type: audio/wav' \
      --data-binary @"$file" "$URL")"
    code="${timing%% *}"
    total="${timing##* }"
    echo "$(basename "$file") run $run: HTTP $code, ${total}s end to end"
    python3 - "$reply" <<'PY'
import json, sys
body = open(sys.argv[1], encoding="utf-8").read()
try:
    data = json.loads(body)
except ValueError:
    print("  " + body[:300])
else:
    if "text" in data:
        print(f"  {data['seconds']}s of speech, {data['ms']} ms in the model")
        print("  " + data["text"])
    else:
        print("  " + json.dumps(data, ensure_ascii=False))
PY
    rm -f "$reply"
  done
done
