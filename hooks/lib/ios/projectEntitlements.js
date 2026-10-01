/*
Adds the Associated Domains entitlement required by Universal Links.

IMPORTANT: this plugin must never own or recreate the application's complete
entitlements set. Other Cordova plugins (Firebase/APNs, Sign in with Apple,
Keychain groups, etc.) may write to the same entitlements file.

This module therefore reads the current entitlements plist, preserves every
existing key/value exactly as provided by the other plugins/Cordova, and only
adds or updates `com.apple.developer.associated-domains`.
*/

var path = require('path');
var fs = require('fs');
var plist = require('plist');
var mkpath = require('mkpath');
var ConfigXmlHelper = require('../configXmlHelper.js');
var ASSOCIATED_DOMAINS = 'com.apple.developer.associated-domains';
var context;
var projectName;
var entitlementsFilePath;

module.exports = {
  generateAssociatedDomainsEntitlements: generateEntitlements
};

function generateEntitlements(cordovaContext, pluginPreferences) {
  context = cordovaContext;

  var filePath = pathToEntitlementsFile();
  var currentEntitlements = readEntitlements(filePath);
  var associatedDomains = generateAssociatedDomainsContent(pluginPreferences);

  // Merge only the key owned by this plugin. Do not delete, replace or
  // synthesize entitlements owned by Cordova or other plugins (e.g.
  // aps-environment from Firebase/APNs).
  currentEntitlements[ASSOCIATED_DOMAINS] = associatedDomains;

  saveEntitlements(filePath, currentEntitlements);
}

function readEntitlements(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  var content = fs.readFileSync(filePath, 'utf8');
  if (!content || !content.trim()) {
    return {};
  }

  var parsed = plist.parse(content);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function saveEntitlements(filePath, entitlements) {
  mkpath.sync(path.dirname(filePath));
  fs.writeFileSync(filePath, plist.build(entitlements), 'utf8');
}

function generateAssociatedDomainsContent(pluginPreferences) {
  var domainsList = [];

  pluginPreferences.hosts.forEach(function(host) {
    var link = 'applinks:' + host.name;
    if (domainsList.indexOf(link) === -1) {
      domainsList.push(link);
    }
  });

  return domainsList;
}

function pathToEntitlementsFile() {
  if (entitlementsFilePath === undefined) {
    var iosPath = path.join(getProjectRoot(), 'platforms', 'ios');
    var appProjectPath = path.join(iosPath, 'App.xcodeproj');

    if (fs.existsSync(appProjectPath)) {
      entitlementsFilePath = path.join(iosPath, 'App', 'Resources', 'App.entitlements');
    } else {
      entitlementsFilePath = path.join(iosPath, getProjectName(), 'Resources', getProjectName() + '.entitlements');
    }
  }

  return entitlementsFilePath;
}

function getProjectRoot() {
  return context.opts.projectRoot;
}

function getProjectName() {
  if (projectName === undefined) {
    var configXmlHelper = new ConfigXmlHelper(context);
    projectName = configXmlHelper.getProjectName();
  }

  return projectName;
}
