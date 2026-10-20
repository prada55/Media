// ios/Runner/AppDelegate.swift
//
// Confidentialité : quand l'app passe en arrière-plan (sélecteur d'apps,
// centre de contrôle), un voile flouté masque le contenu pour que
// l'instantané système ne montre aucune donnée financière.
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private static let privacyViewTag = 0x59414B4F  // "YAKO"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let center = NotificationCenter.default
    center.addObserver(
      self, selector: #selector(sceneWillDeactivate(_:)),
      name: UIScene.willDeactivateNotification, object: nil)
    center.addObserver(
      self, selector: #selector(sceneDidActivate(_:)),
      name: UIScene.didActivateNotification, object: nil)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  @objc private func sceneWillDeactivate(_ notification: Notification) {
    guard let scene = notification.object as? UIWindowScene else { return }
    for window in scene.windows where window.viewWithTag(Self.privacyViewTag) == nil {
      let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
      blur.frame = window.bounds
      blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      blur.tag = Self.privacyViewTag
      window.addSubview(blur)
    }
  }

  @objc private func sceneDidActivate(_ notification: Notification) {
    guard let scene = notification.object as? UIWindowScene else { return }
    for window in scene.windows {
      window.viewWithTag(Self.privacyViewTag)?.removeFromSuperview()
    }
  }
}
