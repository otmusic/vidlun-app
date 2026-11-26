import Foundation

/*
 * The backup as a plain ZIP (the readable export of 2026-11-19, and the
 * backup itself since 2026-11-23, owner's word), written here rather than by
 * Foundation. A folder read "for uploading" does come back
 * zipped, but its names are stored as UTF-8 without the flag that says so,
 * and Windows then shows "Щоденник.md" as noise. Every name here carries that
 * flag (bit 11).
 *
 * Entries are stored, not deflated: the voice is AAC already and the text is
 * small, so compression would buy nothing and cost a dependency. Files are
 * streamed in chunks, never read whole, because a journal's voice can run to
 * hundreds of megabytes. The classic format's 4 GB limit is checked rather
 * than assumed.
 */
enum ZipFolder {
  private static let chunk = 1 << 20
  private static let utf8Names: UInt16 = 0x0800

  /// Everything under `folder`, the folder itself at the archive's root, as a ZIP at `archive`.
  static func write(folder: URL, to archive: URL) throws {
    let manager = FileManager.default

    try? manager.removeItem(at: archive)

    guard manager.createFile(atPath: archive.path, contents: nil) else {
      throw BackupFailure.stream("zip file")
    }

    let out = try FileHandle(forWritingTo: archive)
    defer { try? out.close() }

    var central = Data()
    var count = 0
    var offset: UInt64 = 0

    for item in try entries(in: folder) {
      let name = Array(item.name.utf8)
      let (crc, size) = item.isDirectory ? (UInt32(0), UInt64(0)) : try checksum(of: item.url)
      let (time, date) = dosStamp(item.modified)

      guard size <= UInt64(UInt32.max), offset <= UInt64(UInt32.max), name.count <= Int(UInt16.max) else {
        throw BackupFailure.stream("zip size")
      }

      var local = Data()
      local.append(le32: 0x0403_4b50)
      local.append(le16: 20)
      local.append(le16: utf8Names)
      local.append(le16: 0)
      local.append(le16: time)
      local.append(le16: date)
      local.append(le32: crc)
      local.append(le32: UInt32(size))
      local.append(le32: UInt32(size))
      local.append(le16: UInt16(name.count))
      local.append(le16: 0)
      local.append(contentsOf: name)

      try out.write(contentsOf: local)

      if !item.isDirectory {
        try copy(item.url, into: out)
      }

      central.append(le32: 0x0201_4b50)
      central.append(le16: 20)
      central.append(le16: 20)
      central.append(le16: utf8Names)
      central.append(le16: 0)
      central.append(le16: time)
      central.append(le16: date)
      central.append(le32: crc)
      central.append(le32: UInt32(size))
      central.append(le32: UInt32(size))
      central.append(le16: UInt16(name.count))
      central.append(le16: 0)
      central.append(le16: 0)
      central.append(le16: 0)
      central.append(le16: 0)
      central.append(le32: item.isDirectory ? 0x10 : 0)
      central.append(le32: UInt32(offset))
      central.append(contentsOf: name)

      offset += UInt64(local.count) + size
      count += 1
    }

    guard count <= Int(UInt16.max), offset <= UInt64(UInt32.max) else {
      throw BackupFailure.stream("zip size")
    }

    var end = Data()
    end.append(le32: 0x0605_4b50)
    end.append(le16: 0)
    end.append(le16: 0)
    end.append(le16: UInt16(count))
    end.append(le16: UInt16(count))
    end.append(le32: UInt32(central.count))
    end.append(le32: UInt32(offset))
    end.append(le16: 0)

    try out.write(contentsOf: central)
    try out.write(contentsOf: end)
  }

  private struct Entry {
    let name: String
    let url: URL
    let isDirectory: Bool
    let modified: Date
  }

  /// The folder and everything in it, by name, so the archive reads the same every time.
  private static func entries(in folder: URL) throws -> [Entry] {
    let keys: [URLResourceKey] = [.isDirectoryKey, .contentModificationDateKey]
    // Resolved on both sides: iOS hands out /var paths whose files list as /private/var.
    let root = folder.resolvingSymlinksInPath()
    let prefix = root.path.hasSuffix("/") ? root.path : root.path + "/"
    let top = root.lastPathComponent

    guard let walker = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys) else {
      throw BackupFailure.stream("zip listing")
    }

    var found = [Entry(name: top + "/", url: root, isDirectory: true, modified: Date())]

    for case let url as URL in walker {
      let values = try url.resourceValues(forKeys: Set(keys))
      let isDirectory = values.isDirectory ?? false
      let path = url.resolvingSymlinksInPath().path

      guard path.hasPrefix(prefix) else {
        throw BackupFailure.stream("zip path")
      }

      let relative = String(path.dropFirst(prefix.count))

      found.append(Entry(
        name: top + "/" + relative + (isDirectory ? "/" : ""),
        url: url,
        isDirectory: isDirectory,
        modified: values.contentModificationDate ?? Date()))
    }

    return found.sorted { $0.name < $1.name }
  }

  private static func checksum(of url: URL) throws -> (UInt32, UInt64) {
    let input = try FileHandle(forReadingFrom: url)
    defer { try? input.close() }

    var crc: UInt32 = 0xFFFF_FFFF
    var size: UInt64 = 0

    /*
     * Each chunk in a pool of its own. `read(upToCount:)` hands back
     * autoreleased data, and the whole backup runs in one block on Expo's
     * queue, so without a pool every megabyte read stayed in memory until
     * the backup ended: 303 MB at the peak for 300 MB of voice, 3 MB with
     * the pool (native review, 2026-11-26).
     */
    while try autoreleasepool(invoking: { () throws -> Bool in
      guard let data = try input.read(upToCount: chunk), !data.isEmpty else {
        return false
      }

      crc = running(crc, over: data)
      size += UInt64(data.count)

      return true
    }) {}

    return (crc ^ 0xFFFF_FFFF, size)
  }

  /// The CRC-32 carried on over `data`; start at all ones and flip the bits at the end.
  static func running(_ crc: UInt32, over data: Data) -> UInt32 {
    var crc = crc

    for byte in data {
      crc = table[Int((crc ^ UInt32(byte)) & 0xFF)] ^ (crc >> 8)
    }

    return crc
  }

  private static func copy(_ url: URL, into out: FileHandle) throws {
    let input = try FileHandle(forReadingFrom: url)
    defer { try? input.close() }

    // A pool per chunk, as in `checksum`.
    while try autoreleasepool(invoking: { () throws -> Bool in
      guard let data = try input.read(upToCount: chunk), !data.isEmpty else {
        return false
      }

      try out.write(contentsOf: data)

      return true
    }) {}
  }

  /// MS-DOS time and date, in the phone's own time zone, as unzip tools expect.
  private static func dosStamp(_ date: Date) -> (UInt16, UInt16) {
    let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
    let year = max(1980, min(2107, parts.year ?? 1980))
    let time = ((parts.hour ?? 0) << 11) | ((parts.minute ?? 0) << 5) | ((parts.second ?? 0) / 2)
    let day = ((year - 1980) << 9) | ((parts.month ?? 1) << 5) | (parts.day ?? 1)

    return (UInt16(time), UInt16(day))
  }

  private static let table: [UInt32] = (0..<256).map { value in
    var crc = UInt32(value)

    for _ in 0..<8 {
      crc = (crc & 1) != 0 ? 0xEDB8_8320 ^ (crc >> 1) : crc >> 1
    }

    return crc
  }
}

private extension Data {
  mutating func append(le16 value: UInt16) {
    append(UInt8(value & 0xFF))
    append(UInt8(value >> 8))
  }

  mutating func append(le32 value: UInt32) {
    for shift in stride(from: 0, to: 32, by: 8) {
      append(UInt8((value >> UInt32(shift)) & 0xFF))
    }
  }
}
