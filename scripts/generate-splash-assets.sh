#!/bin/sh
# Regenerates the splash wordmark and installs it into the iOS project.
# Run after `expo prebuild` (which wipes ios/) — idempotent otherwise.
set -eu
cd "$(dirname "$0")/.."

swift scripts/generate-splash-wordmark.swift

ASSETS=ios/Vidlun/Images.xcassets
mkdir -p "$ASSETS/SplashBackground.colorset" "$ASSETS/SplashScreen.imageset"
cp assets/splash/wordmark-light*.png assets/splash/wordmark-dark*.png "$ASSETS/SplashScreen.imageset/"

cat > "$ASSETS/SplashBackground.colorset/Contents.json" <<'JSON'
{
  "colors" : [
    {
      "color" : {
        "color-space" : "srgb",
        "components" : { "alpha" : "1.000", "blue" : "0xF0", "green" : "0xF7", "red" : "0xFB" }
      },
      "idiom" : "universal"
    },
    {
      "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ],
      "color" : {
        "color-space" : "srgb",
        "components" : { "alpha" : "1.000", "blue" : "0x1D", "green" : "0x18", "red" : "0x16" }
      },
      "idiom" : "universal"
    }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON

cat > "$ASSETS/SplashScreen.imageset/Contents.json" <<'JSON'
{
  "images" : [
    { "filename" : "wordmark-light.png", "idiom" : "universal", "scale" : "1x" },
    { "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ], "filename" : "wordmark-dark.png", "idiom" : "universal", "scale" : "1x" },
    { "filename" : "wordmark-light@2x.png", "idiom" : "universal", "scale" : "2x" },
    { "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ], "filename" : "wordmark-dark@2x.png", "idiom" : "universal", "scale" : "2x" },
    { "filename" : "wordmark-light@3x.png", "idiom" : "universal", "scale" : "3x" },
    { "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ], "filename" : "wordmark-dark@3x.png", "idiom" : "universal", "scale" : "3x" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON

python3 - <<'PY'
p = 'ios/Vidlun/SplashScreen.storyboard'
s = open(p).read()
changed = False
plain = '<color key="backgroundColor" systemColor="systemBackgroundColor"/>'
if plain in s:
    s = s.replace(plain, '<color key="backgroundColor" name="SplashBackground"/>')
    changed = True
anchor = 'secondAttribute="centerX" id="zR4-NK-mVN"'
if anchor in s:
    # Half the overlay's dots-and-gap span, so the mark holds still when the
    # JS splash mounts and the ensemble takes the centre.
    s = s.replace(anchor, 'secondAttribute="centerX" constant="-18.25" id="zR4-NK-mVN"')
    changed = True
stale = '<image name="SplashScreenLogo" width="100" height="90.333335876464844"/>'
if stale in s:
    s = s.replace(stale, '<image name="SplashScreen" width="129" height="47"/>')
    changed = True
legacy = """        <systemColor name="systemBackgroundColor">
            <color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>
        </systemColor>"""
named = """        <namedColor name="SplashBackground">
            <color red="0.984" green="0.969" blue="0.941" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>"""
if legacy in s:
    s = s.replace(legacy, named)
    changed = True
if changed:
    open(p, 'w').write(s)
print('storyboard: ' + ('patched' if changed else 'already in place'))
PY
echo "Splash assets installed."
