#!/usr/bin/env bash
# Serves the built asset pack to a test device or simulator the way the App
# Store would, so delivery can be checked before the pack is uploaded.
#
# ba-serve speaks TLS and needs an identity in the login keychain whose name
# is exactly the --host value; a self-signed one is made and trusted on first
# use. The test device then has to trust the same certificate: a simulator
# with `xcrun simctl keychain <udid> add-root-cert <crt>`, a phone by opening
# the .crt in Safari, installing the profile, and enabling it under
# Settings > General > About > Certificate Trust Settings. Finally, on the
# device: Settings > Developer > Background Assets Testing > Development
# Overrides > URL Override = https://<host>:<port>. Only development-signed
# builds use the override; a TestFlight build ignores it.
#
# Usage: scripts/serve-asset-pack.sh [host] [port]
set -euo pipefail

HOST="${1:-$(ipconfig getifaddr en0)}"
PORT="${2:-65020}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACK="$ROOT/asset-packs/parakeet-tdt-06b-v3-q8.aar"
CERT_DIR="$ROOT/asset-packs/dev-server"
CRT="$CERT_DIR/$HOST.crt"

[ -f "$PACK" ] || { echo "No pack at $PACK — run scripts/build-asset-pack.sh first." >&2; exit 1; }

if ! security find-identity -v -p ssl-server 2>/dev/null | grep -q "\"$HOST\""; then
  echo "Making a self-signed TLS identity for $HOST..."
  mkdir -p "$CERT_DIR"
  cat > "$CERT_DIR/$HOST.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $HOST
[ext]
subjectAltName = IP:$HOST,DNS:$HOST
basicConstraints = critical,CA:TRUE
keyUsage = critical,digitalSignature,keyEncipherment,keyCertSign
extendedKeyUsage = serverAuth
CNF
  openssl req -x509 -newkey rsa:2048 -sha256 -days 800 -nodes \
    -keyout "$CERT_DIR/$HOST.key" -out "$CRT" -config "$CERT_DIR/$HOST.cnf" 2>/dev/null
  openssl pkcs12 -export -out "$CERT_DIR/$HOST.p12" -inkey "$CERT_DIR/$HOST.key" -in "$CRT" \
    -passout pass:vidlun-dev -name "$HOST"
  security import "$CERT_DIR/$HOST.p12" -k ~/Library/Keychains/login.keychain-db -P vidlun-dev \
    -T /Applications/Xcode.app/Contents/Developer/usr/bin/ba-serve
  # Self-signed is "invalid" until trusted; ba-serve only takes valid identities.
  security add-trusted-cert -r trustRoot -p ssl -k ~/Library/Keychains/login.keychain-db "$CRT"
  rm -f "$CERT_DIR/$HOST.key" "$CERT_DIR/$HOST.p12"
fi

echo "Override URL for the device:  https://$HOST:$PORT"
echo "Certificate to trust there:   $CRT"
echo "Simulator: xcrun simctl keychain <udid> add-root-cert \"$CRT\""
echo
exec xcrun ba-serve serve "$PACK" --asset-pack-versions 1 --host "$HOST" --port "$PORT" --choose-identity-automatically
