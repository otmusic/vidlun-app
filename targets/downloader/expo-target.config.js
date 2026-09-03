/**
 * The Background Download extension: the one piece of native code Managed
 * Background Assets requires. It answers a single question — should this
 * asset pack be downloaded — and the system does the rest: the speech model
 * arrives with the App Store install, before the app is first opened.
 *
 * Declared as `app-intent` rather than `bg-download` on purpose. The App
 * Store requires a Background Assets downloader to be an ExtensionKit
 * extension (an `Extensions/` bundle carrying `EXAppExtensionAttributes`),
 * and `app-intent` is the one target type this plugin builds with the
 * ExtensionKit product type; `bg-download` produces a legacy NSExtension in
 * `PlugIns/`, which the upload rejects. The extension point itself comes
 * from this directory's own Info.plist, which the plugin never regenerates.
 *
 * iOS 26 is where managed asset packs begin; older phones never load this
 * extension and keep the in-app download instead.
 */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'app-intent',
  name: 'downloader',
  displayName: 'Vidlun Downloader',
  bundleIdentifier: 'com.vidlun.journal.downloader',
  deploymentTarget: '26.0',
  frameworks: ['BackgroundAssets'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.vidlun.journal'],
  },
};
