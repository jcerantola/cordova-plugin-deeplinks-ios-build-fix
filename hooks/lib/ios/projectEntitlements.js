/*
Adds the Associated Domains entitlement required by Universal Links.

cordova-ios 8 may use configuration-specific entitlement files such as:
  App/Entitlements-Debug.plist
  App/Entitlements-Release.plist

Other plugins (notably Firebase/APNs) may own and update those files. We must
merge `com.apple.developer.associated-domains` into the entitlement file(s)
actually selected by CODE_SIGN_ENTITLEMENTS, never replace the full set.
*/

var path = require('path');
var fs = require('fs');
var plist = require('plist');
var mkpath = require('mkpath');
var xcode = require('xcode');
var glob = require('glob');
var ASSOCIATED_DOMAINS = 'com.apple.developer.associated-domains';
var COMMENT_KEY = /_comment$/;

module.exports = {
  generateAssociatedDomainsEntitlements: generateEntitlements
};

function generateEntitlements(context, pluginPreferences) {
  var iosPath = path.join(context.opts.projectRoot, 'platforms', 'ios');
  var associatedDomains = generateAssociatedDomainsContent(pluginPreferences);
  var entitlementFiles = findActiveEntitlementsFiles(iosPath);

  if (entitlementFiles.length === 0) {
    entitlementFiles.push(path.join(iosPath, 'App', 'Resources', 'App.entitlements'));
  }

  entitlementFiles.forEach(function(filePath) {
    mergeAssociatedDomains(filePath, associatedDomains);
  });

  console.log('[cordova-plugin-deeplinks] Associated Domains merged into: ' + entitlementFiles.join(', '));
}

function findActiveEntitlementsFiles(iosPath) {
  var projectFiles = glob.globSync(path.join(iosPath, '*.xcodeproj', 'project.pbxproj'));
  if (!projectFiles.length) {
    return [];
  }

  var project = xcode.project(projectFiles[0]);
  project.parseSync();

  var configurations = project.pbxXCBuildConfigurationSection();
  var result = [];
  var isCordovaIos8Project = fs.existsSync(path.join(iosPath, 'App.xcodeproj'));

  Object.keys(configurations).forEach(function(key) {
    if (COMMENT_KEY.test(key)) {
      return;
    }

    var entry = configurations[key];
    var settings = entry && entry.buildSettings;
    if (!settings || !settings.CODE_SIGN_ENTITLEMENTS) {
      return;
    }

    var rawPath = unquote(settings.CODE_SIGN_ENTITLEMENTS);
    var configName = unquote(settings.CONFIGURATION || entry.name || '');

    // IMPORTANT: on cordova-ios 8 the native Xcode target/source directory is
    // App, while PRODUCT_NAME may be the display name (e.g. "Scoop Delivery").
    // TARGET_NAME and PRODUCT_NAME are therefore NOT interchangeable.
    var targetName = isCordovaIos8Project ? 'App' : unquote(settings.TARGET_NAME || '');
    var productName = unquote(settings.PRODUCT_NAME || targetName || 'App');

    var resolved = rawPath
      .replace(/\$\(TARGET_NAME\)/g, targetName || 'App')
      .replace(/\$\{TARGET_NAME\}/g, targetName || 'App')
      .replace(/\$\(PRODUCT_NAME\)/g, productName || 'App')
      .replace(/\$\{PRODUCT_NAME\}/g, productName || 'App')
      .replace(/\$\(CONFIGURATION\)/g, configName)
      .replace(/\$\{CONFIGURATION\}/g, configName);

    if (/\$\(|\$\{/.test(resolved)) {
      return;
    }

    var absolutePath = path.isAbsolute(resolved) ? resolved : path.join(iosPath, resolved);
    if (result.indexOf(absolutePath) === -1) {
      result.push(absolutePath);
    }
  });

  return result;
}

function mergeAssociatedDomains(filePath, associatedDomains) {
  var entitlements = {};

  if (fs.existsSync(filePath)) {
    var content = fs.readFileSync(filePath, 'utf8');
    if (content && content.trim()) {
      var parsed = plist.parse(content);
      if (parsed && typeof parsed === 'object') {
        entitlements = parsed;
      }
    }
  }

  // This plugin owns only Associated Domains. Preserve Firebase/APNs and every
  // other entitlement already present in the file.
  entitlements[ASSOCIATED_DOMAINS] = associatedDomains;

  mkpath.sync(path.dirname(filePath));
  fs.writeFileSync(filePath, plist.build(entitlements), 'utf8');
}

function generateAssociatedDomainsContent(pluginPreferences) {
  var domains = [];

  pluginPreferences.hosts.forEach(function(host) {
    var value = 'applinks:' + host.name;
    if (domains.indexOf(value) === -1) {
      domains.push(value);
    }
  });

  return domains;
}

function unquote(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).replace(/^['\"]|['\"]$/g, '');
}
