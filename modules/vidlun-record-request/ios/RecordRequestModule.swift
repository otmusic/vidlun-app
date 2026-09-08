import ExpoModulesCore

/*
 * The app's side of "Record in Vidlun" from Siri, the Shortcuts app and the
 * Control Center button. Those run `RecordIntent` inside the app after the
 * system has opened it, and the intent leaves a note: a flag in the app's
 * defaults and a notification. The flag survives the moment the note is made
 * before JavaScript is listening — the cold start Siri causes — and the
 * notification covers the app already being open.
 *
 * A URL would be the natural carrier, and it is what the widgets use, but a
 * URL that arrives between launch and the first JavaScript listener is
 * dropped by React Native, and that is exactly when Siri delivers it.
 *
 * The two names below are repeated in `targets/widget/_shared/RecordIntent.swift`
 * on purpose: the intent is compiled into the app target and the widget,
 * never into this pod.
 */
public class RecordRequestModule: Module {
  static let flag = "vidlun.recordRequested"
  static let arrived = Notification.Name("VidlunRecordRequested")

  public func definition() -> ModuleDefinition {
    Name("VidlunRecordRequest")

    Events("request")

    OnStartObserving {
      NotificationCenter.default.addObserver(
        self, selector: #selector(self.noteArrived), name: Self.arrived, object: nil
      )
    }

    OnStopObserving {
      NotificationCenter.default.removeObserver(self, name: Self.arrived, object: nil)
    }

    /// Whether a request is waiting; taking it clears it, so it is honoured once.
    Function("take") { () -> Bool in
      let defaults = UserDefaults.standard
      let pending = defaults.bool(forKey: Self.flag)

      if pending {
        defaults.removeObject(forKey: Self.flag)
      }

      return pending
    }
  }

  @objc private func noteArrived() {
    sendEvent("request", [:])
  }
}
