import Foundation

/*
 * The journal unreadable on a locked phone (owner's word, 2026-11-26). New
 * files get this class from the app's entitlement; what was written before
 * it kept the default, readable after the first unlock since boot, so this
 * moves every file already there once.
 *
 * Complete-unless-open rather than complete: a file open when the phone
 * locks stays usable, so a take being written and a month playing with the
 * screen off go on, and a new file can still be written while locked.
 */
enum DataProtection {
  static let level = FileProtectionType.completeUnlessOpen

  /// Every file and folder the app wrote, in the class new ones get. Returns how many changed.
  static func protectAll() -> Int {
    let manager = FileManager.default
    var roots: [URL] = [manager.temporaryDirectory]

    for directory in [FileManager.SearchPathDirectory.documentDirectory, .applicationSupportDirectory, .cachesDirectory] {
      if let url = manager.urls(for: directory, in: .userDomainMask).first {
        roots.append(url)
      }
    }

    return roots.reduce(0) { changed, root in changed + protect(tree: root, with: manager) }
  }

  private static func protect(tree root: URL, with manager: FileManager) -> Int {
    var changed = set(root, with: manager) ? 1 : 0

    // A folder that cannot be read is skipped; the rest is still moved.
    guard
      let walker = manager.enumerator(
        at: root,
        includingPropertiesForKeys: [.fileProtectionKey, .isSymbolicLinkKey],
        options: [],
        errorHandler: { _, _ in true })
    else {
      return changed
    }

    for case let url as URL in walker {
      autoreleasepool {
        if set(url, with: manager) {
          changed += 1
        }
      }
    }

    return changed
  }

  /// True when the item was moved; a link, an item already there or one that refuses is left.
  private static func set(_ url: URL, with manager: FileManager) -> Bool {
    let values = try? url.resourceValues(forKeys: [.fileProtectionKey, .isSymbolicLinkKey])

    if values?.isSymbolicLink == true || values?.fileProtection == .completeUnlessOpen {
      return false
    }

    do {
      try manager.setAttributes([.protectionKey: level], ofItemAtPath: url.path)

      return true
    } catch {
      return false
    }
  }
}
