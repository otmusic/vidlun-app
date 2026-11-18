import AVFoundation
import AppleArchive
import Foundation
import System

/// Why a backup step could not finish, named so the JS side can log it.
enum BackupFailure: Error, CustomStringConvertible {
  case stream(String)
  case audio(String)

  var description: String {
    switch self {
    case .stream(let step): return "The archive could not be opened at \(step)."
    case .audio(let step): return "The recording could not be converted at \(step)."
    }
  }
}

/// The work behind the backup module, kept apart from the Expo glue so it reads as plain Swift.
enum BackupFiles {
  /// AAC at this rate keeps a voice clearly a voice at about a sixth of the WAV's size.
  static let voiceBitRate = 24_000

  /// A recorder's WAV as a small AAC file — kept on the phone and in the backup alike.
  static func compress(wav: URL, to m4a: URL) throws {
    let format = try AVAudioFile(forReading: wav).processingFormat

    try convert(from: wav, to: m4a, settings: [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: format.sampleRate,
      AVNumberOfChannelsKey: format.channelCount,
      AVEncoderBitRateKey: voiceBitRate,
    ])

    // Dated as the take was, so the file still says when the voice is from.
    if let recordedAt = try FileManager.default.attributesOfItem(atPath: wav.path)[.modificationDate] {
      try FileManager.default.setAttributes([.modificationDate: recordedAt], ofItemAtPath: m4a.path)
    }
  }

  /// Every file under `directory`, packed into one Apple Archive at `archive`.
  static func pack(directory: URL, into archive: URL) throws {
    try? FileManager.default.removeItem(at: archive)

    guard let file = ArchiveByteStream.fileStream(
      path: FilePath(archive.path), mode: .writeOnly, options: [.create, .truncate],
      permissions: FilePermissions(rawValue: 0o644))
    else { throw BackupFailure.stream("file") }
    defer { try? file.close() }

    guard let compress = ArchiveByteStream.compressionStream(using: .lzfse, writingTo: file)
    else { throw BackupFailure.stream("compression") }
    defer { try? compress.close() }

    guard let encode = ArchiveStream.encodeStream(writingTo: compress)
    else { throw BackupFailure.stream("encoding") }
    defer { try? encode.close() }

    // Type, path, mode, data and date: nothing about the phone's owner travels.
    guard let keys = ArchiveHeader.FieldKeySet("TYP,PAT,MOD,DAT,MTM")
    else { throw BackupFailure.stream("keys") }

    try encode.writeDirectoryContents(archiveFrom: FilePath(directory.path), keySet: keys)
  }

  /// An Apple Archive unpacked into `directory`, which it creates.
  static func unpack(archive: URL, into directory: URL) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    guard let file = ArchiveByteStream.fileStream(
      path: FilePath(archive.path), mode: .readOnly, options: [],
      permissions: FilePermissions(rawValue: 0o644))
    else { throw BackupFailure.stream("file") }
    defer { try? file.close() }

    guard let decompress = ArchiveByteStream.decompressionStream(readingFrom: file)
    else { throw BackupFailure.stream("decompression") }
    defer { try? decompress.close() }

    guard let decode = ArchiveStream.decodeStream(readingFrom: decompress)
    else { throw BackupFailure.stream("decoding") }
    defer { try? decode.close() }

    guard let extract = ArchiveStream.extractStream(
      extractingTo: FilePath(directory.path), flags: [.ignoreOperationNotPermitted])
    else { throw BackupFailure.stream("extraction") }
    defer { try? extract.close() }

    _ = try ArchiveStream.process(readingFrom: decode, writingTo: extract)
  }

  /// Reads one file into another in chunks, so an hour of audio never sits in memory whole.
  private static func convert(from source: URL, to target: URL, settings: [String: Any]) throws {
    let input = try AVAudioFile(forReading: source)
    let format = input.processingFormat

    try? FileManager.default.removeItem(at: target)

    // Scoped so the output file is closed, and its header final, before anyone reads it.
    do {
      let output = try AVAudioFile(
        forWriting: target, settings: settings, commonFormat: format.commonFormat,
        interleaved: format.isInterleaved)

      guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 16_384)
      else { throw BackupFailure.audio("buffer") }

      while input.framePosition < input.length {
        try input.read(into: buffer)

        if buffer.frameLength == 0 {
          break
        }

        try output.write(from: buffer)
      }
    }
  }
}
