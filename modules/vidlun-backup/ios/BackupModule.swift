import ExpoModulesCore

/*
 * The voice kept small, and the backup with it (owner's word, 2026-11-18):
 * recordings are kept on the phone as AAC rather than WAV. The backup is one
 * ZIP since 2026-11-23, readable anywhere and restorable here; the Apple
 * Archive it was before is still unpacked, so an older backup comes home.
 * Everything here streams from disk to disk, because years of someone's
 * voice is a lot of data and the JS heap is not where it should pass through.
 */
public class BackupModule: Module {
  /*
   * Its own queue, at utility priority. On Expo's shared queue a backup of
   * hundreds of megabytes, or the compaction that runs at launch, made the
   * record tap wait behind it: expo-audio prepares the recorder on that same
   * serial queue (native review, 2026-11-26).
   */
  private let work = DispatchQueue(label: "app.vidlun.backup", qos: .utility)

  public func definition() -> ModuleDefinition {
    Name("VidlunBackup")

    /// The WAV at `source` as a small AAC file at `target`, dated as the WAV was.
    AsyncFunction("compressAudio") { (source: String, target: String) in
      try BackupFiles.compress(wav: try fileURL(source), to: try fileURL(target))
    }.runOnQueue(work)

    /// Everything under the directory at `source`, packed into one archive at `target`.
    AsyncFunction("pack") { (source: String, target: String) in
      try BackupFiles.pack(directory: try fileURL(source), into: try fileURL(target))
    }.runOnQueue(work)

    /// The archive at `source`, unpacked into the directory at `target`.
    AsyncFunction("unpack") { (source: String, target: String) in
      try BackupFiles.unpack(archive: try fileURL(source), into: try fileURL(target))
    }.runOnQueue(work)

    /// The directory at `source`, itself at the root, as a plain ZIP at `target`: the backup.
    AsyncFunction("zip") { (source: String, target: String) in
      try ZipFolder.write(folder: try fileURL(source), to: try fileURL(target))
    }.runOnQueue(work)

    /// The ZIP at `source`, ours or packed again elsewhere, unpacked into the directory at `target`.
    AsyncFunction("unzip") { (source: String, target: String) in
      try ZipReader.read(archive: try fileURL(source), into: try fileURL(target))
    }.runOnQueue(work)

    /// Every file the app already wrote, moved to the protection class new files get; how many moved.
    AsyncFunction("protectAppData") { () -> Int in
      DataProtection.protectAll()
    }.runOnQueue(work)
  }
}

/// Expo hands over file URLs; plain paths are accepted too.
private func fileURL(_ uri: String) throws -> URL {
  let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)

  guard let url else {
    throw Exception(name: "BadBackupUri", description: "Not a file: \(uri)")
  }

  return url
}
