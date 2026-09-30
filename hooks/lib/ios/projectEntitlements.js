/* Generates the Associated Domains entitlements file. */

var path = require('path');
var fs = require('fs');
var plist = require('plist');
var mkpath = require('mkpath');
var ConfigXmlHelper = require('../configXmlHelper.js');
var ASSOCIATED_DOMAINS = 'com.apple.developer.associated-domains';
var context;

module.exports = {
  generateAssociatedDomainsEntitlements: generateEntitlements
};

function generateEntitlements(cordovaContext, pluginPreferences) {
  context = cordovaContext;
  var currentEntitlements = getEntitlementsFileContent();
  currentEntitlements[ASSOCIATED_DOMAINS] = generateAssociatedDomainsContent(pluginPreferences);
  saveContentToEntitlementsFile(currentEntitlements);
}

function saveContentToEntitlementsFile(content) {
  var filePath = pathToEntitlementsFile();
  mkpath.sync(path.dirname(filePath));
  fs.writeFileSync(filePath, plist.build(content), 'utf8');
  console.log('Associated Domains entitlements written to: ' + filePath);
}

function getEntitlementsFileContent() {
  var filePath = pathToEntitlementsFile();
  try {
    return plist.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return {};
  }
}

function generateAssociatedDomainsContent(pluginPreferences) {
  var domainsList = [];
  pluginPreferences.hosts.forEach(function(host) {
    var link = 'applinks:' + host.name;
    if (domainsList.indexOf(link) === -1) domainsList.push(link);
  });
  return domainsList;
}

function iosPlatformPath() {
  return path.join(context.opts.projectRoot, 'platforms', 'ios');
}

function isCordovaIos8Layout() {
  return fs.existsSync(path.join(iosPlatformPath(), 'App.xcodeproj'));
}

function pathToEntitlementsFile() {
  if (isCordovaIos8Layout()) {
    return path.join(iosPlatformPath(), 'App', 'Resources', 'App.entitlements');
  }

  var configXmlHelper = new ConfigXmlHelper(context);
  var projectName = configXmlHelper.getProjectName();
  return path.join(iosPlatformPath(), projectName, 'Resources', projectName + '.entitlements');
}
