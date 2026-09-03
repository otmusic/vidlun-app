import BackgroundAssets

/*
 * Managed, Apple-hosted: the system reads the pack manifest from the App
 * Store, downloads what the policy says (the speech model is `essential`,
 * so it comes down with the install), keeps it up to date, and hands the
 * files to the app through AssetPackManager. All this extension decides is
 * whether a given pack is wanted — and every pack this app publishes is.
 */
@main
struct DownloaderExtension: ManagedDownloaderExtension {
  func shouldDownload(_ assetPack: AssetPack) -> Bool {
    return true
  }
}
