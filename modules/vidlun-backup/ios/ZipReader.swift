import Compression
import Foundation

/*
 * The backup's way home (owner's word, 2026-11-23): the readable ZIP is the
 * backup now, so the app reads a ZIP as well as writing one. Its own
 * archives are stored; one that a Mac or the Files app packed again is
 * deflated, so both methods are read, streamed in chunks like the writer.
 *
 * Nothing lands outside the target folder: a name that climbs out ("../")
 * or starts at the root refuses the whole file, before anything is written
 * for it. The Mac's "__MACOSX" shadow folder and its "._" files are skipped.
 * Every file is checked against its size and CRC, so a damaged backup says
 * so instead of restoring half a recording.
 */
enum ZipReader {
  private static let chunk = 1 << 20
  private static let endSignature: UInt32 = 0x0605_4b50
  private static let centralSignature: UInt32 = 0x0201_4b50
  private static let localSignature: UInt32 = 0x0403_4b50

  private struct Entry {
    let name: String
    let flags: UInt16
    let method: UInt16
    let crc: UInt32
    let compressed: UInt64
    let size: UInt64
    let offset: UInt64
  }

  /// Everything in the ZIP at `archive`, unpacked under `folder`, which it creates.
  static func read(archive: URL, into folder: URL) throws {
    let manager = FileManager.default

    try manager.createDirectory(at: folder, withIntermediateDirectories: true)

    let root = folder.resolvingSymlinksInPath().standardizedFileURL
    let input = try FileHandle(forReadingFrom: archive)
    defer { try? input.close() }

    let entries = try centralDirectory(of: input)
    // Every name is checked before the first byte is written.
    let placed = try entries.map { entry in (entry, try place(entry.name, under: root)) }

    for (entry, target) in placed {
      guard let target else {
        continue
      }

      if entry.name.hasSuffix("/") {
        try manager.createDirectory(at: target, withIntermediateDirectories: true)
        continue
      }

      try manager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      try extract(entry, from: input, to: target)
    }
  }

  /// Where an entry goes under `root`; nil for what is skipped. Throws for a name that would leave it.
  private static func place(_ name: String, under root: URL) throws -> URL? {
    guard !name.hasPrefix("/"), !name.contains("\\"), !name.contains("\0") else {
      throw BackupFailure.stream("zip name")
    }

    let parts = name.split(separator: "/").filter { $0 != "." }

    guard !parts.contains("..") else {
      throw BackupFailure.stream("zip name")
    }

    guard let last = parts.last, parts.first != "__MACOSX", !last.hasPrefix("._") else {
      return nil
    }

    let target = parts.reduce(root) { $0.appendingPathComponent(String($1)) }.standardizedFileURL

    guard target.path.hasPrefix(root.path + "/") else {
      throw BackupFailure.stream("zip name")
    }

    return target
  }

  private static func centralDirectory(of input: FileHandle) throws -> [Entry] {
    let length = try input.seekToEnd()
    let tailLength = min(length, UInt64(22 + 0xFFFF))

    try input.seek(toOffset: length - tailLength)

    let tail = [UInt8](try input.read(upToCount: Int(tailLength)) ?? Data())

    guard let end = lastSignature(endSignature, in: tail, room: 22) else {
      throw BackupFailure.stream("zip end")
    }

    let count = le16(tail, end + 10)
    let size = le32(tail, end + 12)
    let start = le32(tail, end + 16)

    // The ZIP64 markers: no backup of ours comes near them, and reading them is not worth the risk.
    guard count != 0xFFFF, size != 0xFFFF_FFFF, start != 0xFFFF_FFFF,
          UInt64(start) + UInt64(size) <= length
    else {
      throw BackupFailure.stream("zip directory")
    }

    try input.seek(toOffset: UInt64(start))

    let directory = [UInt8](try input.read(upToCount: Int(size)) ?? Data())

    guard directory.count == Int(size) else {
      throw BackupFailure.stream("zip directory")
    }

    var entries: [Entry] = []
    var at = 0

    for _ in 0..<Int(count) {
      guard at + 46 <= directory.count, le32(directory, at) == centralSignature else {
        throw BackupFailure.stream("zip directory")
      }

      let nameEnd = at + 46 + Int(le16(directory, at + 28))
      let compressed = le32(directory, at + 20)
      let size = le32(directory, at + 24)
      let offset = le32(directory, at + 42)

      guard nameEnd <= directory.count,
            compressed != 0xFFFF_FFFF, size != 0xFFFF_FFFF, offset != 0xFFFF_FFFF
      else {
        throw BackupFailure.stream("zip directory")
      }

      let raw = Data(directory[(at + 46)..<nameEnd])

      guard let name = String(data: raw, encoding: .utf8) ?? String(data: raw, encoding: .isoLatin1) else {
        throw BackupFailure.stream("zip name")
      }

      entries.append(Entry(
        name: name,
        flags: le16(directory, at + 8),
        method: le16(directory, at + 10),
        crc: le32(directory, at + 16),
        compressed: UInt64(compressed),
        size: UInt64(size),
        offset: UInt64(offset)))

      at = nameEnd + Int(le16(directory, at + 30)) + Int(le16(directory, at + 32))
    }

    return entries
  }

  private static func extract(_ entry: Entry, from input: FileHandle, to target: URL) throws {
    guard entry.flags & 0x1 == 0 else {
      throw BackupFailure.stream("zip encrypted")
    }

    try input.seek(toOffset: entry.offset)

    let header = [UInt8](try input.read(upToCount: 30) ?? Data())

    guard header.count == 30, le32(header, 0) == localSignature else {
      throw BackupFailure.stream("zip entry")
    }

    try input.seek(toOffset: entry.offset + 30 + UInt64(le16(header, 26)) + UInt64(le16(header, 28)))

    let manager = FileManager.default

    try? manager.removeItem(at: target)

    guard manager.createFile(atPath: target.path, contents: nil) else {
      throw BackupFailure.stream("zip file")
    }

    let out = try FileHandle(forWritingTo: target)
    defer { try? out.close() }

    var crc: UInt32 = 0xFFFF_FFFF
    var written: UInt64 = 0

    func keep(_ data: Data) throws {
      written += UInt64(data.count)

      guard written <= entry.size else {
        throw BackupFailure.stream("zip size")
      }

      crc = ZipFolder.running(crc, over: data)
      try out.write(contentsOf: data)
    }

    switch entry.method {
    case 0:
      try stream(entry.compressed, from: input, into: keep)
    case 8:
      let inflate = try OutputFilter(.decompress, using: .zlib) { data in
        if let data {
          try keep(data)
        }
      }

      try stream(entry.compressed, from: input) { try inflate.write($0) }
      try inflate.finalize()
    default:
      throw BackupFailure.stream("zip method")
    }

    guard written == entry.size, crc ^ 0xFFFF_FFFF == entry.crc else {
      throw BackupFailure.stream("zip checksum")
    }
  }

  private static func stream(_ count: UInt64, from input: FileHandle, into sink: (Data) throws -> Void) throws {
    var left = count

    // A pool per chunk, or a restore holds the whole archive it has read until it ends.
    while left > 0 {
      try autoreleasepool {
        let data = try input.read(upToCount: Int(min(left, UInt64(chunk)))) ?? Data()

        guard !data.isEmpty else {
          throw BackupFailure.stream("zip truncated")
        }

        try sink(data)
        left -= UInt64(data.count)
      }
    }
  }

  private static func lastSignature(_ signature: UInt32, in bytes: [UInt8], room: Int) -> Int? {
    guard bytes.count >= room else {
      return nil
    }

    for at in stride(from: bytes.count - room, through: 0, by: -1) where le32(bytes, at) == signature {
      return at
    }

    return nil
  }

  private static func le16(_ bytes: [UInt8], _ at: Int) -> UInt16 {
    UInt16(bytes[at]) | UInt16(bytes[at + 1]) << 8
  }

  private static func le32(_ bytes: [UInt8], _ at: Int) -> UInt32 {
    UInt32(bytes[at]) | UInt32(bytes[at + 1]) << 8 | UInt32(bytes[at + 2]) << 16 | UInt32(bytes[at + 3]) << 24
  }
}
