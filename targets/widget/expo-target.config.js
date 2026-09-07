/**
 * Record without opening the app: the widgets on the Lock Screen and the
 * Home Screen, the Control Center button, and — through the intent the
 * `_shared` folder gives both targets — Siri and the Action Button. All of
 * them do one thing, open the app straight on the recording screen, which
 * is what turns "ten seconds" into three.
 *
 * iOS 18 is where Control Center buttons begin; older phones simply do not
 * offer the widgets and keep the app exactly as it is.
 */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'widget',
  displayName: 'Vidlun',
  bundleIdentifier: 'com.vidlun.journal.widget',
  deploymentTarget: '18.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  // The identity's tokens, both themes; the widget cannot read the app's theme file.
  colors: {
    $widgetBackground: { light: '#FBF7F0', dark: '#1B1E25' },
    $accent: { light: '#4433E0', dark: '#8B7BFF' },
    canvas: { light: '#FBF7F0', dark: '#1B1E25' },
    ink: { light: '#16181D', dark: '#F2EEE6' },
    inkSoft: { light: '#55585F', dark: '#A9AEB8' },
    line: { light: '#E2DACB', dark: '#2C313B' },
    solid: { light: '#16181D', dark: '#F2EEE6' },
    onSolid: { light: '#FBF7F0', dark: '#14161B' },
    lime: { light: '#D7F26B', dark: '#D7F26B' },
  },
  // No app group: nothing here reads the journal, and an entitlement the
  // widget does not use is one more capability to provision and explain.
  entitlements: {},
};
