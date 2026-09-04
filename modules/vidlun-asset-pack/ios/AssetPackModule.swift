import ExpoModulesCore
import System

#if canImport(BackgroundAssets)
import BackgroundAssets
#endif

/*
 * The app's window onto Managed Background Assets: where a file inside a
 * delivered pack lives, and — when the install did not bring the pack —
 * the request for the system to bring it now.
 *
 * One question rather than two for the location on purpose. Asking "is the
 * pack here" needs iOS 26.4; asking for the file's location works from 26.0
 * and answers both, since a file that resolves is a pack that arrived —
 * provided the file is checked for, not only the path: a location the
 * system can name is not yet a file it has delivered.
 *
 * Below iOS 26 both answers are simply "not here" rather than a failure, so
 * the JavaScript side falls through to the in-app download.
 */
public class AssetPackModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VidlunAssetPack")

    Events("progress")

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

    /*
     * Asks the system for a pack the app publishes and waits for it to land.
     * True once it is on disk. False where the system cannot answer at all —
     * below iOS 26, or for a pack it has never heard of — so the caller can
     * download by itself. Throws when the system knew the pack and could not
     * bring it. Progress goes out as events while the transfer runs.
     */
    AsyncFunction("ensure") { (assetPackID: String) async throws -> Bool in
      #if canImport(BackgroundAssets)
      if #available(iOS 26, *) {
        let manager = AssetPackManager.shared
        let pack: AssetPack

        do {
          pack = try await manager.assetPack(withID: assetPackID)
        } catch {
          return false
        }

        let watcher = Task { [weak self] in
          for await update in manager.statusUpdates(forAssetPackWithID: assetPackID) {
            switch update {
            case .downloading(_, let progress):
              self?.sendEvent("progress", [
                "id": assetPackID,
                "completed": Double(progress.completedUnitCount),
                "total": Double(progress.totalUnitCount),
              ])
            case .finished, .failed:
              return
            default:
              continue
            }
          }
        }

        defer { watcher.cancel() }

        try await manager.ensureLocalAvailability(of: pack)

        return true
      }
      #endif
      return false
    }
  }
}
