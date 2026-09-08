import AppIntents
import Foundation

/*
 * The one thing the Control Center button, Siri, the Shortcuts app and the
 * Action Button all do: open the app straight on the recording screen.
 *
 * `openAppWhenRun` makes the system open the app first and run this inside
 * it. The request is then left as a note the app reads on its own time — a
 * flag in the app's defaults plus a notification — rather than as a URL: a
 * URL handed to an app that has just launched arrives before its JavaScript
 * is listening and is dropped, which is how Siri opened the home screen. The
 * widgets keep their URL; the system launches the app with it, and a launch
 * URL is never dropped.
 *
 * Shared with the app target on purpose: an intent that opens the app has to
 * exist on both sides, or the system cannot resolve it. The two names are
 * repeated in `modules/vidlun-record-request`, which the widget never links.
 */
@available(iOS 18.0, *)
struct RecordIntent: AppIntent {
  static let title: LocalizedStringResource = "Record in Vidlun"
  static let description = IntentDescription("Opens Vidlun ready to record an entry.")
  static let openAppWhenRun = true
  static let isDiscoverable = true

  @MainActor
  func perform() async throws -> some IntentResult {
    UserDefaults.standard.set(true, forKey: "vidlun.recordRequested")
    NotificationCenter.default.post(name: Notification.Name("VidlunRecordRequested"), object: nil)

    return .result()
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
