import ExpoModulesCore
import MediaPlayer

/*
 * The voice measured from a kept recording, on the phone, after the entry is
 * saved. Never the live microphone: the take is already on disk as plain PCM,
 * so measuring it touches nothing about recording, and a failure here costs
 * a reading, never a take.
 */
public class VoiceModule: Module {
  /// The lock screen's previous and next buttons while a month plays, and their targets.
  private var trackTargets: [(MPRemoteCommand, Any)] = []

  /// Off Expo's shared queue, where the recorder is prepared: measuring a
  /// take must never hold up the next record tap (native review, 2026-11-26).
  private let work = DispatchQueue(label: "app.vidlun.voice", qos: .utility)

  public func definition() -> ModuleDefinition {
    Name("VidlunVoice")

    /// "previous" or "next" from the lock screen or the Dynamic Island while a month plays.
    Events("onTrackCommand")

    /// Measures the recording at `uri` (a file URL or a path); runs off the main thread.
    AsyncFunction("analyze") { (uri: String) -> [String: Any] in
      let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
      guard let url else {
        throw Exception(name: "BadRecordingUri", description: "Not a file: \(uri)")
      }
      return try VoiceAnalysis.analyze(url: url).dictionary
    }.runOnQueue(work)

    /// Where the speech is in the recording at `uri`, as [from, to] pairs in
    /// milliseconds, for finding a searched word in it; runs off the main thread.
    AsyncFunction("speechSpans") { (uri: String) -> [[Double]] in
      let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
      guard let url else {
        throw Exception(name: "BadRecordingUri", description: "Not a file: \(uri)")
      }
      return try VoiceAnalysis.speechSpans(url: url)
    }.runOnQueue(work)

    /// Each recording's length in milliseconds, -1 for one that cannot be read.
    AsyncFunction("montageLengths") { (uris: [String]) async -> [Double] in
      await MonthMontage.lengths(uris)
    }

    /// Joins stretches of kept takes into one AAC file at `out`, for a month
    /// heard in its own voice; returns where each landed, in milliseconds.
    AsyncFunction("composeMontage") {
      (clips: [MontageClip], out: String, gapMs: Double, fadeInMs: Double, fadeOutMs: Double) async throws
        -> [[Double]] in
      guard let url = MonthMontage.fileURL(out) else {
        throw Exception(name: "BadMontageUri", description: "Not a file: \(out)")
      }
      return try await MonthMontage.compose(
        clips, out: url, gapMs: gapMs, fadeInMs: fadeInMs, fadeOutMs: fadeOutMs)
    }

    /// Shows ◀◀ ▶▶ on the lock screen and in the Dynamic Island, between the
    /// month's entries rather than ten seconds back and on (owner's word,
    /// 2026-11-23); false takes them away again.
    Function("setTrackCommands") { (enabled: Bool) in
      DispatchQueue.main.async { [weak self] in
        self?.setTrackCommands(enabled)
      }
    }

    /*
     * The targets are taken now, not on the main queue later: by then the
     * module is gone, a weak self is nil, and ◀◀ ▶▶ stayed on the lock
     * screen with nothing behind them (native review, 2026-11-26).
     */
    OnDestroy {
      let targets = self.trackTargets
      self.trackTargets = []

      DispatchQueue.main.async {
        let center = MPRemoteCommandCenter.shared()

        for (command, target) in targets {
          command.removeTarget(target)
        }
        center.previousTrackCommand.isEnabled = false
        center.nextTrackCommand.isEnabled = false
      }
    }
  }

  private func setTrackCommands(_ enabled: Bool) {
    let center = MPRemoteCommandCenter.shared()

    for (command, target) in trackTargets {
      command.removeTarget(target)
    }
    trackTargets = []
    center.previousTrackCommand.isEnabled = enabled
    center.nextTrackCommand.isEnabled = enabled

    guard enabled else {
      return
    }

    for (command, direction) in [(center.previousTrackCommand, "previous"), (center.nextTrackCommand, "next")] {
      let target = command.addTarget { [weak self] _ in
        self?.sendEvent("onTrackCommand", ["direction": direction])
        return .success
      }
      trackTargets.append((command, target))
    }
  }
}
