# Cordova Deeplinks Plugin

## Cordova iOS 8.1 / UIScene / cold-start support

This fork updates the classic `cordova-plugin-deeplinks` for **cordova-ios 8.1.0** while preserving its existing JavaScript API, `<universal-links>` configuration and Android implementation.

### Status

Validated on a real iOS device with the application completely terminated:

**Universal Link / QR code → iOS launches the app → configured deeplink event reaches JavaScript → app opens the requested content.**

The cold-start handling is included in this plugin. A separate cold-start plugin is not required.

### Installation

```sh
cordova plugin add https://github.com/jcerantola/cordova-plugin-deeplinks-ios-build-fix.git#fix/cordova-ios-8-build-only
```

Or in `package.json`:

```json
"cordova-plugin-deeplinks": "git+https://github.com/jcerantola/cordova-plugin-deeplinks-ios-build-fix.git#fix/cordova-ios-8-build-only"
```

### Configuration

This fork continues to use the original `<universal-links>` configuration. Variables such as `URL_SCHEME`, `DEEPLINK_SCHEME`, `DEEPLINK_HOST` and `ANDROID_PATH_PREFIX` are **not required**.

```xml
<universal-links>
    <host name="example.com" scheme="https" event="launchedAppFromLink">
        <path url="/menu-*"/>
        <path url="/p/*"/>
    </host>
</universal-links>
```

JavaScript remains compatible with the original plugin:

```js
universalLinks.subscribe('launchedAppFromLink', function (eventData) {
    if (eventData.path) {
        // Route eventData.path inside your application.
    }
});
```

## What was fixed

### 1. cordova-ios 8 Xcode project layout

cordova-ios 8 always generates the native Xcode project as `App.xcodeproj`. Older plugin hooks assumed that the physical project name matched the application's display name.

The iOS hooks now correctly use:

```text
App.xcodeproj
App/Resources/App.entitlements
```

The obsolete `shelljs` dependency used by the old hook for a basic filesystem operation was also replaced with Node's built-in `fs` API.

### 2. UIScene warm-start Universal Links

cordova-ios 8 uses the Scene lifecycle. The plugin now listens for `CDVPluginContinueUserActivityNotification` and forwards its `NSUserActivity` to the plugin's existing `handleUserActivity:` method.

The original host/path matching, event creation and JavaScript subscription behavior are preserved.

### 3. UIScene cold-start Universal Links

When an iOS application is completely terminated, a Universal Link can arrive in `connectionOptions.userActivities` during `scene(_:willConnectTo:options:)`, before Cordova's WebView and plugin observers are ready.

This fork includes an `AppSceneDelegate` subclass of `CDVSceneDelegate` that:

1. captures the URL and/or browsing `NSUserActivity` supplied at cold launch;
2. buffers that data while Cordova initializes;
3. waits for `CDVPageDidLoadNotification`;
4. replays custom URLs through `CDVPluginHandleOpenURLNotification`;
5. replays Universal Links through `CDVPluginContinueUserActivityNotification`;
6. lets the existing deeplink implementation dispatch the configured event to JavaScript.

An `after_prepare` hook updates the generated iOS `Info.plist` to use `AppSceneDelegate`. Normal Cordova Scene behavior is preserved because the class subclasses `CDVSceneDelegate` and calls `super`.

## Android

The Android implementation was intentionally left unchanged. The Scene and cold-start additions are iOS-only, so this same plugin can continue to be used in Android builds.

## Scope

This is a compatibility patch rather than a rewrite. It deliberately preserves:

- the original `universalLinks` JavaScript API;
- the original `<universal-links>` configuration;
- host/path/event matching;
- application-side deeplink routing;
- the existing Android implementation.

The changes are limited to cordova-ios 8 build compatibility and iOS Scene lifecycle delivery, including cold start.

## Background

This repository is a fork in the lineage of the original `cordova-universal-links-plugin` / `cordova-plugin-deeplinks`. Earlier versions of this fork also included Android compatibility and fixes for changes in the `glob` dependency.

For the original plugin concepts, website association setup and API documentation, refer to the upstream Cordova Universal Links Plugin documentation.
