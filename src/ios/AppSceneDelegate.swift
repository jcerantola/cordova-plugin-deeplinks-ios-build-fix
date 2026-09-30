import UIKit
import Cordova

/// Scene delegate used on cordova-ios 8 to preserve Universal Links received
/// during a cold launch until Cordova's WebView/plugins are ready.
@objc(AppSceneDelegate)
public class AppSceneDelegate: CDVSceneDelegate {

    private var pendingLaunchURL: URL?
    private var pendingLaunchUserActivity: NSUserActivity?
    private var pageLoadObserver: NSObjectProtocol?

    public override func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        super.scene(scene, willConnectTo: session, options: connectionOptions)

        let launchURL = connectionOptions.urlContexts.first?.url
        let launchUserActivity = connectionOptions.userActivities.first(where: {
            $0.activityType == NSUserActivityTypeBrowsingWeb && $0.webpageURL != nil
        })

        guard launchURL != nil || launchUserActivity != nil else {
            return
        }

        pendingLaunchURL = launchURL
        pendingLaunchUserActivity = launchUserActivity

        pageLoadObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("CDVPageDidLoadNotification"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.replayPendingLaunchData()
        }
    }

    public override func scene(
        _ scene: UIScene,
        openURLContexts URLContexts: Set<UIOpenURLContext>
    ) {
        super.scene(scene, openURLContexts: URLContexts)
    }

    private func replayPendingLaunchData() {
        if let observer = pageLoadObserver {
            NotificationCenter.default.removeObserver(observer)
            pageLoadObserver = nil
        }

        if let url = pendingLaunchURL {
            pendingLaunchURL = nil
            NotificationCenter.default.post(
                name: NSNotification.Name("CDVPluginHandleOpenURLNotification"),
                object: url
            )
        }

        if let userActivity = pendingLaunchUserActivity {
            pendingLaunchUserActivity = nil
            NotificationCenter.default.post(
                name: NSNotification.Name("CDVPluginContinueUserActivityNotification"),
                object: userActivity
            )
        }
    }
}
