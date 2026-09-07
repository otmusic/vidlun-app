import AppIntents
import Foundation

/*
 * The one thing the widgets, the Control Center button, Siri and the Action
 * Button all do: open the app straight on the recording screen. It arrives
 * in the app as a URL, the same way a tap on a widget does, so there is one
 * path into a take from outside the app and one place that handles it.
 *
 * Shared with the app target on purpose: an intent that opens the app has to
 * exist on both sides, or the system cannot resolve it.
 */
@available(iOS 18.0, *)
struct RecordIntent: AppIntent {
  static let title: LocalizedStringResource = "Record in Vidlun"
  static let description = IntentDescription("Opens Vidlun ready to record an entry.")
  static let openAppWhenRun = true
  static let isDiscoverable = true

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    return .result(opensIntent: OpenURLIntent(URL(string: "vidlun://record")!))
  }
}

/*
 * What Siri and the Shortcuts app know the intent as, and what the Action
 * Button can be set to. Siri does not speak Ukrainian, so the English phrases
 * are the ones that will be heard; the Ukrainian one is for the Shortcuts app.
 */
@available(iOS 18.0, *)
struct VidlunShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: RecordIntent(),
      phrases: [
        "Record in \(.applicationName)",
        "Record an entry in \(.applicationName)",
        "Запиши у \(.applicationName)",
      ],
      shortTitle: "Record",
      systemImageName: "mic"
    )
  }
}
