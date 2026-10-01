/*
Script activates support required by Universal Links without taking ownership
of the application's code-signing entitlements.

IMPORTANT: CODE_SIGN_ENTITLEMENTS is owned by cordova-ios / the application and
other plugins such as Firebase/APNs. This plugin must never create, replace or
redirect it. Associated Domains are merged separately into the entitlement
files already selected by the Xcode target.
*/

var path = require('path');
var compare = require('node-version-compare');
var IOS_DEPLOYMENT_TARGET = '8.0';
var COMMENT_KEY = /_comment$/;
var context;

module.exports = {
  enableAssociativeDomainsCapability: enableAssociativeDomainsCapability
};

function enableAssociativeDomainsCapability(cordovaContext) {
  context = cordovaContext;
  var projectFile = loadProjectFile();
  updateDeploymentTargetOnly(projectFile.xcode);
  projectFile.write();
}

function updateDeploymentTargetOnly(xcodeProject) {
  var configurations = nonComments(xcodeProject.pbxXCBuildConfigurationSection());
  var config;
  var buildSettings;
  var deploymentTargetIsUpdated = false;
  var configuredEntitlements = [];

  for (config in configurations) {
    buildSettings = configurations[config].buildSettings;

    // Diagnostic only. Never mutate CODE_SIGN_ENTITLEMENTS.
    if (buildSettings['CODE_SIGN_ENTITLEMENTS']) {
      configuredEntitlements.push(buildSettings['CODE_SIGN_ENTITLEMENTS'] + ' (untouched)');
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

  console.log('IOS project Code Sign Entitlements left untouched: ' + (configuredEntitlements.length ? configuredEntitlements.join(', ') : 'none configured at this stage'));
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
