/*
Script activates support for Universal Links in the application.

On cordova-ios 8 the application may already have an entitlements file managed
by Cordova or another plugin (for example Firebase/APNs). This plugin must not
replace CODE_SIGN_ENTITLEMENTS or add the entitlements plist to Copy Bundle
Resources. It only ensures a fallback entitlements path when none exists.
*/

var path = require('path');
var compare = require('node-version-compare');
var ConfigXmlHelper = require('../configXmlHelper.js');
var IOS_DEPLOYMENT_TARGET = '8.0';
var COMMENT_KEY = /_comment$/;
var context;

module.exports = {
  enableAssociativeDomainsCapability: enableAssociativeDomainsCapability
};

function enableAssociativeDomainsCapability(cordovaContext) {
  context = cordovaContext;
  var projectFile = loadProjectFile();
  activateAssociativeDomains(projectFile.xcode);
  projectFile.write();
}

function activateAssociativeDomains(xcodeProject) {
  var configurations = nonComments(xcodeProject.pbxXCBuildConfigurationSection());
  var fallbackEntitlementsFilePath = pathToEntitlementsFile();
  var config;
  var buildSettings;
  var deploymentTargetIsUpdated;
  var configuredEntitlements = [];

  for (config in configurations) {
    buildSettings = configurations[config].buildSettings;

    // Preserve an entitlement file already selected by Cordova/Firebase/APNs.
    // Only provide our historical App.entitlements path when the target has no
    // CODE_SIGN_ENTITLEMENTS at all.
    if (!buildSettings['CODE_SIGN_ENTITLEMENTS']) {
      buildSettings['CODE_SIGN_ENTITLEMENTS'] = '"' + fallbackEntitlementsFilePath + '"';
      configuredEntitlements.push(fallbackEntitlementsFilePath + ' (fallback)');
    } else {
      configuredEntitlements.push(buildSettings['CODE_SIGN_ENTITLEMENTS'] + ' (preserved)');
    }

    if (buildSettings['IPHONEOS_DEPLOYMENT_TARGET']) {
      if (compare(buildSettings['IPHONEOS_DEPLOYMENT_TARGET'], IOS_DEPLOYMENT_TARGET) == -1) {
        buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = IOS_DEPLOYMENT_TARGET;
        deploymentTargetIsUpdated = true;
      }
    } else {
      buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = IOS_DEPLOYMENT_TARGET;
      deploymentTargetIsUpdated = true;
    }
  }

  if (deploymentTargetIsUpdated) {
    console.log('IOS project now has deployment target set as: ' + IOS_DEPLOYMENT_TARGET);
  }

  console.log('IOS project Code Sign Entitlements preserved/configured as: ' + configuredEntitlements.join(', '));
}

function loadProjectFile() {
  var platform_ios;
  var projectFile;

  try {
    platform_ios = context.requireCordovaModule('cordova-lib/src/plugman/platforms')['ios'];
    projectFile = platform_ios.parseProjectFile(iosPlatformPath());
  } catch (e) {
    try {
      platform_ios = context.requireCordovaModule('cordova-lib/src/plugman/platforms/ios');
      projectFile = platform_ios.parseProjectFile(iosPlatformPath());
    } catch (e) {
      console.log('Cordova 7.0+ detected - apply globSync()');
      var project_files = require('glob').globSync(path.join(iosPlatformPath(), '*.xcodeproj', 'project.pbxproj'));
      console.log('project_files:');
      console.log(project_files);

      if (project_files.length === 0) {
        throw new Error('does not appear to be an xcode project (no xcode project file)');
      }

      var pbxPath = project_files[0];
      var xcodeproj = require('xcode').project(pbxPath);
      xcodeproj.parseSync();

      projectFile = {
        xcode: xcodeproj,
        write: function() {
          var fs = require('fs');
          var frameworks_file = path.join(iosPlatformPath(), 'frameworks.json');
          var frameworks = {};
          try {
            frameworks = context.requireCordovaModule(frameworks_file);
          } catch (e) { }

          fs.writeFileSync(pbxPath, xcodeproj.writeSync());
          if (Object.keys(frameworks).length === 0) {
            try {
              fs.unlinkSync(frameworks_file);
            } catch (e) {
              if (e.code !== 'ENOENT') {
                throw e;
              }
            }
            return;
          }
          fs.writeFileSync(frameworks_file, JSON.stringify(this.frameworks, null, 4));
        }
      };
    }
  }

  return projectFile;
}

function nonComments(obj) {
  var keys = Object.keys(obj);
  var newObj = {};

  for (var i = 0, len = keys.length; i < len; i++) {
    if (!COMMENT_KEY.test(keys[i])) {
      newObj[keys[i]] = obj[keys[i]];
    }
  }

  return newObj;
}

function iosPlatformPath() {
  return path.join(projectRoot(), 'platforms', 'ios');
}

function projectRoot() {
  return context.opts.projectRoot;
}

function pathToEntitlementsFile() {
  var projectFiles = require('glob').globSync(path.join(iosPlatformPath(), '*.xcodeproj'));
  if (projectFiles.some(function(projectFile) { return path.basename(projectFile) === 'App.xcodeproj'; })) {
    return path.join('App', 'Resources', 'App.entitlements');
  }

  var configXmlHelper = new ConfigXmlHelper(context),
    projectName = configXmlHelper.getProjectName(),
    fileName = projectName + '.entitlements';

  return path.join(projectName, 'Resources', fileName);
}
