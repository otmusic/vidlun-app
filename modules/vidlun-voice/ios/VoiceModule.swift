import ExpoModulesCore

/*
 * The voice measured from a kept recording, on the phone, after the entry is
 * saved. Never the live microphone: the take is already on disk as plain PCM,
 * so measuring it touches nothing about recording, and a failure here costs
 * a reading, never a take.
 */
public class VoiceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VidlunVoice")

    /// Measures the recording at `uri` (a file URL or a path); runs off the main thread.
    AsyncFunction("analyze") { (uri: String) -> [String: Any] in
      let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
      guard let url else {
        throw Exception(name: "BadRecordingUri", description: "Not a file: \(uri)")
      }
      return try VoiceAnalysis.analyze(url: url).dictionary
    }
  }
}
