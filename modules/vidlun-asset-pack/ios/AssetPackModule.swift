import ExpoModulesCore
import System

#if canImport(BackgroundAssets)
import BackgroundAssets
#endif

/*
 * The app's window onto Managed Background Assets: where a file inside a
 * delivered pack lives. Everything else — downloading, updating, verifying —
 * the system does; the app never asks for a pack to be fetched, because the
 * policy in the manifest already had it fetched with the install.
 *
 * One question rather than two on purpose. Asking "is the pack here" needs
 * iOS 26.4; asking for the file's location works from 26.0 and answers both,
 * since a file that resolves is a pack that arrived — provided the file is
 * checked for, not only the path: a location the system can name is not yet
 * a file it has delivered.
 *
 * Below iOS 26 the answer is simply "not here" rather than a failure, so
 * the JavaScript side falls through to the in-app download.
 */
public class AssetPackModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VidlunAssetPack")

    Function("fileURL") { (path: String) -> String? in
      #if canImport(BackgroundAssets)
      if #available(iOS 26, *) {
        guard let url = try? AssetPackManager.shared.url(for: FilePath(path)),
              FileManager.default.fileExists(atPath: url.path) else {
          return nil
        }

        return url.absoluteString
      }
      #endif
      return nil
    }
  }
}
