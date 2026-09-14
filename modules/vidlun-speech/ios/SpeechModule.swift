import AVFoundation
import ExpoModulesCore

#if canImport(Speech)
import Speech
#endif

/*
 * The phone's own ear, for the languages it knows: SpeechAnalyzer on iOS 26
 * and later, which runs entirely on the device and has no server path — so
 * the promise that no audio leaves the phone holds here as it does for the
 * model. It reads a finished file, which is what the recorder produces, and
 * reading a file needs no speech-recognition authorisation, only the
 * microphone the take already had.
 *
 * Below iOS 26, and for languages the system cannot read, every answer is
 * "not available" rather than an error, and the JavaScript side keeps the
 * model — which is what reads Ukrainian and mixed speech everywhere.
 */
public class SpeechModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VidlunSpeech")

    /// Whether this device can read the language by itself.
    AsyncFunction("isAvailable") { (localeID: String) async -> Bool in
      #if canImport(Speech)
      if #available(iOS 26, *) {
        return await Self.supportedLocale(localeID) != nil
      }
      #endif
      return false
    }

    /*
     * Brings the language's assets onto the device if they are not there
     * yet. The system keeps them, shares them between apps and consolidates
     * requests, so calling this on every launch costs nothing once the
     * assets are installed.
     */
    AsyncFunction("prepare") { (localeID: String) async throws -> String in
      #if canImport(Speech)
      if #available(iOS 26, *) {
        guard let locale = await Self.supportedLocale(localeID) else {
          throw SpeechUnavailable()
        }

        let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)

        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
          try await request.downloadAndInstall()
          return "installed"
        }

        return "ready"
      }
      #endif
      throw SpeechUnavailable()
    }

    /// The words in a recorded file, final results only, in the order spoken.
    AsyncFunction("transcribe") { (fileURL: String, localeID: String) async throws -> String in
      #if canImport(Speech)
      if #available(iOS 26, *) {
        guard let locale = await Self.supportedLocale(localeID) else {
          throw SpeechUnavailable()
        }
        guard let url = URL(string: fileURL) else {
          throw SpeechUnreadable(path: fileURL)
        }

        let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)

        /*
         * The language assets are normally brought in at launch; asking again
         * here costs nothing once they are installed, and covers the take made
         * before that first request finished.
         */
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
          try await request.downloadAndInstall()
        }

        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let file = try AVAudioFile(forReading: url)

        // Results stream while the file is read, so the reader starts first.
        async let words = Self.collect(transcriber)
        try await analyzer.analyzeSequence(from: file)
        try await analyzer.finalizeAndFinishThroughEndOfInput()

        return try await words
      }
      #endif
      throw SpeechUnavailable()
    }
  }

  @available(iOS 26, *)
  private static func supportedLocale(_ id: String) async -> Locale? {
    await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: id))
  }

  @available(iOS 26, *)
  private static func collect(_ transcriber: SpeechTranscriber) async throws -> String {
    var pieces: [String] = []

    for try await result in transcriber.results where result.isFinal {
      pieces.append(String(result.text.characters))
    }

    return pieces.joined(separator: " ")
  }
}

struct SpeechUnavailable: Error, LocalizedError {
  var errorDescription: String? { "This device cannot read the language by itself." }
}

struct SpeechUnreadable: Error, LocalizedError {
  let path: String
  var errorDescription: String? { "Not a file the recogniser can open: \(path)" }
}
