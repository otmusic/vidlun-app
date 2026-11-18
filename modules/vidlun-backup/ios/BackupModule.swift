import ExpoModulesCore

/*
 * The voice kept small, and the backup with it (owner's word, 2026-11-18):
 * recordings are kept on the phone as AAC rather than WAV, and the whole
 * journal travels as one Apple Archive. Everything here streams from disk to
 * disk, because years of someone's voice is a lot of data and the JS heap is
 * not where it should pass through.
 */
public class BackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VidlunBackup")

    /// The WAV at `source` as a small AAC file at `target`, dated as the WAV was.
    AsyncFunction("compressAudio") { (source: String, target: String) in
      try BackupFiles.compress(wav: try fileURL(source), to: try fileURL(target))
    }

    /// Everything under the directory at `source`, packed into one archive at `target`.
    AsyncFunction("pack") { (source: String, target: String) in
      try BackupFiles.pack(directory: try fileURL(source), into: try fileURL(target))
    }

    /// The archive at `source`, unpacked into the directory at `target`.
    AsyncFunction("unpack") { (source: String, target: String) in
      try BackupFiles.unpack(archive: try fileURL(source), into: try fileURL(target))
    }
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
