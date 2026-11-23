import AVFoundation
import ExpoModulesCore

/// One piece of a month heard in its own voice: a stretch of one kept take.
struct MontageClip: Record {
  @Field var uri: String = ""
  @Field var fromMs: Double = 0
  @Field var toMs: Double = 0
  /// True when the stretch stops before the take does: it fades out rather
  /// than breaking off mid-word.
  @Field var fadeOut: Bool = false
}

/*
 * A month of entries joined into one file on the phone (owner's word,
 * 2026-11-23). One file rather than a queue of takes: it plays on with the
 * screen off without the app having to wake between entries, and the lock
 * screen shows one player for the whole month. Nothing leaves the phone.
 */
enum MonthMontage {
  /// Each recording's length in milliseconds, or -1 for one that cannot be read.
  static func lengths(_ uris: [String]) async -> [Double] {
    var result: [Double] = []

    for uri in uris {
      guard let url = fileURL(uri) else {
        result.append(-1)
        continue
      }

      // Held in a name of its own: an asset let go while it loads cancels the load.
      let asset = AVURLAsset(url: url)
      let duration = try? await asset.load(.duration)

      if let duration, duration.isNumeric, duration.seconds > 0 {
        result.append(duration.seconds * 1000)
      } else {
        result.append(-1)
      }
    }

    return result
  }

  /// Writes the clips, a quiet gap between each, to `out` as AAC, and returns
  /// where each clip landed in it as [start, end] in milliseconds; [-1, -1]
  /// for a clip that could not be read, which is left out rather than
  /// failing the month.
  static func compose(
    _ clips: [MontageClip],
    out: URL,
    gapMs: Double,
    fadeInMs: Double,
    fadeOutMs: Double
  ) async throws -> [[Double]] {
    let composition = AVMutableComposition()

    guard
      let track = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
      )
    else {
      throw Exception(name: "MontageTrack", description: "No audio track could be made")
    }

    let volumes = AVMutableAudioMixInputParameters(track: track)
    var cursor = CMTime.zero
    var placed: [[Double]] = []
    // Every source is held until the file is written: one let go mid-load or
    // mid-export takes its stretch with it.
    var sources: [AVURLAsset] = []

    for clip in clips {
      guard let url = fileURL(clip.uri) else {
        placed.append([-1, -1])
        continue
      }

      let asset = AVURLAsset(url: url)
      sources.append(asset)

      guard
        let source = try? await asset.loadTracks(withMediaType: .audio).first,
        let length = try? await asset.load(.duration)
      else {
        placed.append([-1, -1])
        continue
      }

      let from = time(clip.fromMs)
      let to = CMTimeMinimum(time(clip.toMs), length)

      guard CMTimeCompare(to, from) > 0 else {
        placed.append([-1, -1])
        continue
      }

      let range = CMTimeRange(start: from, end: to)

      if CMTimeCompare(cursor, .zero) > 0 {
        let gap = CMTimeRange(start: cursor, duration: time(gapMs))
        track.insertEmptyTimeRange(gap)
        cursor = CMTimeAdd(cursor, gap.duration)
      }

      do {
        try track.insertTimeRange(range, of: source, at: cursor)
      } catch {
        placed.append([-1, -1])
        continue
      }

      let start = cursor
      let end = CMTimeAdd(cursor, range.duration)
      let fadeIn = time(fadeInMs)
      let fadeOut = time(fadeOutMs)

      volumes.setVolume(1, at: start)

      // Only where both fit, so the two ramps of one clip never overlap.
      if CMTimeCompare(range.duration, CMTimeAdd(fadeIn, fadeOut)) > 0 {
        volumes.setVolumeRamp(
          fromStartVolume: 0,
          toEndVolume: 1,
          timeRange: CMTimeRange(start: start, duration: fadeIn)
        )

        if clip.fadeOut {
          volumes.setVolumeRamp(
            fromStartVolume: 1,
            toEndVolume: 0,
            timeRange: CMTimeRange(start: CMTimeSubtract(end, fadeOut), duration: fadeOut)
          )
        }
      }

      placed.append([start.seconds * 1000, end.seconds * 1000])
      cursor = end
    }

    guard CMTimeCompare(cursor, .zero) > 0 else {
      return placed
    }

    let manager = FileManager.default
    try manager.createDirectory(at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
    try? manager.removeItem(at: out)

    guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
      throw Exception(name: "MontageExport", description: "The month cannot be written")
    }

    let mix = AVMutableAudioMix()
    mix.inputParameters = [volumes]
    session.audioMix = mix

    if #available(iOS 18.0, *) {
      try await session.export(to: out, as: .m4a)
    } else {
      session.outputURL = out
      session.outputFileType = .m4a
      await session.export()

      guard session.status == .completed else {
        throw Exception(
          name: "MontageExport",
          description: session.error?.localizedDescription ?? "The month was not written"
        )
      }
    }

    withExtendedLifetime(sources) {}

    return placed
  }

  static func fileURL(_ uri: String) -> URL? {
    uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
  }

  private static func time(_ ms: Double) -> CMTime {
    CMTime(value: CMTimeValue(max(0, ms.rounded())), timescale: 1000)
  }
}
