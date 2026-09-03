import ExpoModulesCore
import System

#if canImport(BackgroundAssets)
import BackgroundAssets
#endif

/*
 * The app's window onto Managed Background Assets: is a pack on the device,
 * and where is a file inside it. Everything else — downloading, updating,
 * verifying — the system does; the app never asks for a pack to be fetched,
 * because the policy in the manifest already had it fetched with the install.
 *
 * Every answer degrades to "not here" below iOS 26 rather than failing, so
 * the JavaScript side can simply fall through to the in-app download.
 */
public class AssetPackModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VidlunAssetPack")

    Function("isAvailable") { (packID: String) -> Bool in
      #if canImport(BackgroundAssets)
      if #available(iOS 26, *) {
        return AssetPackManager.shared.assetPackIsAvailableLocally(withID: packID)
      }
      #endif
      return false
    }

    /*
     * The file's own location on disk, so the speech engine opens it the way
     * it opens a downloaded one. Nil rather than a throw when the pack is not
     * here: absence is the ordinary answer on most phones today.
     */
    Function("fileURL") { (packID: String, path: String) -> String? in
      #if canImport(BackgroundAssets)
      if #available(iOS 26, *) {
        guard AssetPackManager.shared.assetPackIsAvailableLocally(withID: packID) else {
          return nil
        }

        return try? AssetPackManager.shared.url(for: FilePath(path)).absoluteString
      }
      #endif
      return nil
    }
  }
}
