internal import Expo
import React
import UIKit

/*
 * The scene life cycle, which the iOS 27 SDK requires: an app built with it
 * and still making its window in the app delegate is stopped by UIKit at
 * launch (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
 * 1.9 (57) shipped that way and closed on opening for everyone on iOS 27.
 *
 * Written here because Expo 57 has no scene delegate of its own; Expo 58's
 * `ExpoAppSceneDelegate` does the same job and replaces this file when the
 * project moves to it. Copied into ios/Vidlun by plugins/withSceneDelegate.js.
 *
 * Under scenes UIKit stops calling the app delegate's life-cycle and URL
 * methods, so each one is handed on to it here: Expo's subscribers and
 * React Native's Linking both listen there.
 */
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Code that reads the app delegate's window keeps finding one.
    appDelegate.window = window

    // A link that opened the app cold arrives here, not in launch options,
    // and `Linking.getInitialURL()` reads launch options only.
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: Self.launchOptions(url: connectionOptions.urlContexts.first?.url))

    connectionOptions.urlContexts.forEach(open)
    connectionOptions.userActivities.forEach(carryOn)
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    window = nil
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    URLContexts.forEach(open)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    carryOn(userActivity)
  }

  private func open(_ context: UIOpenURLContext) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let source = context.options.sourceApplication {
      options[.sourceApplication] = source
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    options[.openInPlace] = context.options.openInPlace
    _ = appDelegate?.application(UIApplication.shared, open: context.url, options: options)
  }

  private func carryOn(_ userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  /// The launch options React Native reads a cold-start link from, by the key it reads.
  static func launchOptions(url: URL?) -> [UIApplication.LaunchOptionsKey: Any]? {
    guard let url else {
      return nil
    }
    return [UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsURLKey"): url]
  }
}
