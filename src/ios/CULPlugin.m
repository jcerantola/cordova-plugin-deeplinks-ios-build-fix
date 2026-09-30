//
//  CULPlugin.m
//
//  Created by Nikolay Demyankov on 14.09.15.
//

#import "CULPlugin.h"
#import "CULConfigXmlParser.h"
#import "CULPath.h"
#import "CULHost.h"
#import "CDVPluginResult+CULPlugin.h"
#import "CDVInvokedUrlCommand+CULPlugin.h"
#import "CULConfigJsonParser.h"
#import <Cordova/CDVPluginNotifications.h>

@interface CULPlugin() {
    NSArray *_supportedHosts;
    CDVPluginResult *_storedEvent;
    NSMutableDictionary<NSString *, NSString *> *_subscribers;
}

@end

@implementation CULPlugin

#pragma mark Public API

- (void)pluginInitialize {
    [self localInit];

    // cordova-ios 8 routes Universal Links through CDVSceneDelegate instead of
    // AppDelegate. CDVSceneDelegate posts this notification for both a running
    // scene and (with the Cordova cold-start lifecycle) a launch user activity.
    // Keeping the AppDelegate category preserves the behaviour on older
    // cordova-ios versions.
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onContinueUserActivity:)
                                                 name:CDVPluginContinueUserActivityNotification
                                               object:nil];
}

- (void)onContinueUserActivity:(NSNotification *)notification {
    id activity = notification.object;
    if (![activity isKindOfClass:[NSUserActivity class]]) {
        return;
    }

    NSUserActivity *userActivity = (NSUserActivity *)activity;
    if (![userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb] || userActivity.webpageURL == nil) {
        return;
    }

    [self handleUserActivity:userActivity];
}

- (void)handleOpenURL:(NSNotification*)notification {
    id url = notification.object;
    if (![url isKindOfClass:[NSURL class]]) {
        return;
    }

    CULHost *host = [self findHostByURL:url];
    if (host) {
        [self storeEventWithHost:host originalURL:url];
    }
}

- (BOOL)handleUserActivity:(NSUserActivity *)userActivity {
    [self localInit];

    NSURL *launchURL = userActivity.webpageURL;
    CULHost *host = [self findHostByURL:launchURL];
    if (host == nil) {
        return NO;
    }

    [self storeEventWithHost:host originalURL:launchURL];

    return YES;
}

- (void)onAppTerminate {
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:CDVPluginContinueUserActivityNotification
                                                  object:nil];

    _supportedHosts = nil;
    _subscribers = nil;
    _storedEvent = nil;

    [super onAppTerminate];
}

#pragma mark Private API

- (void)localInit {
    if (_supportedHosts) {
        return;
    }

    _subscribers = [[NSMutableDictionary alloc] init];

    // Get supported hosts from the config.xml or www/ul.json.
    // For now priority goes to json config.
    _supportedHosts = [self getSupportedHostsFromPreferences];
}

- (NSArray<CULHost *> *)getSupportedHostsFromPreferences {
    NSString *jsonConfigPath = [[NSBundle mainBundle] pathForResource:@"ul" ofType:@"json" inDirectory:@"www"];
    if (jsonConfigPath) {
        return [CULConfigJsonParser parseConfig:jsonConfigPath];
    }

    return [CULConfigXmlParser parse];
}

- (void)storeEventWithHost:(CULHost *)host originalURL:(NSURL *)originalUrl {
    _storedEvent = [CDVPluginResult resultWithHost:host originalURL:originalUrl];
    [self tryToConsumeEvent];
}

- (CULHost *)findHostByURL:(NSURL *)launchURL {
    NSURLComponents *urlComponents = [NSURLComponents componentsWithURL:launchURL resolvingAgainstBaseURL:YES];
    CULHost *host = nil;
    for (CULHost *supportedHost in _supportedHosts) {
        NSPredicate *pred = [NSPredicate predicateWithFormat:@"self LIKE[c] %@", supportedHost.name];
        if ([pred evaluateWithObject:urlComponents.host]) {
            host = supportedHost;
            break;
        }
    }

    return host;
}

#pragma mark Methods to send data to JavaScript

- (void)tryToConsumeEvent {
    if (_subscribers.count == 0 || _storedEvent == nil) {
        return;
    }

    NSString *storedEventName = [_storedEvent eventName];
    for (NSString *eventName in _subscribers) {
        if ([storedEventName isEqualToString:eventName]) {
            NSString *callbackID = _subscribers[eventName];
            [self.commandDelegate sendPluginResult:_storedEvent callbackId:callbackID];
            _storedEvent = nil;
            break;
        }
    }
}

#pragma mark Methods, available from JavaScript side

- (void)jsSubscribeForEvent:(CDVInvokedUrlCommand *)command {
    NSString *eventName = [command eventName];
    if (eventName.length == 0) {
        return;
    }

    _subscribers[eventName] = command.callbackId;
    [self tryToConsumeEvent];
}

- (void)jsUnsubscribeFromEvent:(CDVInvokedUrlCommand *)command {
    NSString *eventName = [command eventName];
    if (eventName.length == 0) {
        return;
    }

    [_subscribers removeObjectForKey:eventName];
}

@end
