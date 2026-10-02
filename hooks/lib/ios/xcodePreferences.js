/*
Configures Associated Domains in the generated iOS Xcode project.
Supports both legacy cordova-ios layouts and cordova-ios 8+, where the
Xcode project and native target are always named App.
*/

var path = require('path');
var fs = require('fs');
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
  addPbxReference(projectFile.xcode);
  projectFile.write();
}

function activateAssociativeDomains(xcodeProject) {
  var configurations = nonComments(xcodeProject.pbxXCBuildConfigurationSection());
  var entitlementsFilePath = pathToEntitlementsFile();
  var deploymentTargetIsUpdated;

  Object.keys(configurations).forEach(function(config) {
    var buildSettings = configurations[config].buildSettings;
    if (!buildSettings) return;

    buildSettings.CODE_SIGN_ENTITLEMENTS = '"' + entitlementsFilePath + '"';

    if (buildSettings.IPHONEOS_DEPLOYMENT_TARGET) {
      if (compare(buildSettings.IPHONEOS_DEPLOYMENT_TARGET, IOS_DEPLOYMENT_TARGET) === -1) {
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = IOS_DEPLOYMENT_TARGET;
        deploymentTargetIsUpdated = true;
      }
    } else {
      buildSettings.IPHONEOS_DEPLOYMENT_TARGET = IOS_DEPLOYMENT_TARGET;
      deploymentTargetIsUpdated = true;
    }
  });

  if (deploymentTargetIsUpdated) {
    console.log('IOS project now has deployment target set as: ' + IOS_DEPLOYMENT_TARGET);
  }
  console.log('IOS project Code Sign Entitlements now set to: ' + entitlementsFilePath);
}

function addPbxReference(xcodeProject) {
  // cordova-ios 8 uses App.xcodeproj with the native sources/resources under
  // platforms/ios/App. The entitlements file is a code-signing input, not an
  // application resource. Adding it with addResourceFile() causes the PBX
  // group path to be prepended to CODE_SIGN_ENTITLEMENTS and Xcode resolves
  // App/Resources/App.entitlements as App/Resources/App/Resources/App.entitlements.
  // The file only needs to exist on disk and be referenced by
  // CODE_SIGN_ENTITLEMENTS.
  if (isCordovaIos8Layout()) {
    console.log('cordova-ios 8+ detected; entitlements will not be added to PBXResourcesBuildPhase.');
    return;
  }

  var fileReferenceSection = nonComments(xcodeProject.pbxFileReferenceSection());
  var entitlementsFilePath = pathToEntitlementsFile();
  var entitlementsFileName = path.basename(entitlementsFilePath);

  if (isPbxReferenceAlreadySet(fileReferenceSection, entitlementsFileName)) {
    console.log('Entitlements file is in reference section.');
    return;
  }

  console.log('Entitlements file is not in references section, adding it');
  xcodeProject.addResourceFile(entitlementsFilePath);
}

function isPbxReferenceAlreadySet(fileReferenceSection, entitlementsFileName) {
  return Object.keys(fileReferenceSection).some(function(uuid) {
    var entry = fileReferenceSection[uuid];
    return entry.path && entry.path.indexOf(entitlementsFileName) > -1;
  });
}

function loadProjectFile() {
  var platformPath = iosPlatformPath();
  var projectFiles = require('glob').globSync(path.join(platformPath, '*.xcodeproj', 'project.pbxproj'));

  if (projectFiles.length === 0) {
    throw new Error('does not appear to be an xcode project (no xcode project file)');
  }

  var appProject = path.join(platformPath, 'App.xcodeproj', 'project.pbxproj');
  var pbxPath = fs.existsSync(appProject) ? appProject : projectFiles[0];
  var xcodeproj = require('xcode').project(pbxPath);
  xcodeproj.parseSync();

  return {
    xcode: xcodeproj,
    write: function() {
      fs.writeFileSync(pbxPath, xcodeproj.writeSync());
    }
  };
}

function nonComments(obj) {
  var newObj = {};
  Object.keys(obj).forEach(function(key) {
    if (!COMMENT_KEY.test(key)) newObj[key] = obj[key];
  });
  return newObj;
}

function iosPlatformPath() {
  return path.join(projectRoot(), 'platforms', 'ios');
}

function projectRoot() {
  return context.opts.projectRoot;
}

function isCordovaIos8Layout() {
  return fs.existsSync(path.join(iosPlatformPath(), 'App.xcodeproj'));
}

function pathToEntitlementsFile() {
  if (isCordovaIos8Layout()) {
    return path.join('App', 'Resources', 'App.entitlements');
  }

  var configXmlHelper = new ConfigXmlHelper(context);
  var projectName = configXmlHelper.getProjectName();
  return path.join(projectName, 'Resources', projectName + '.entitlements');
}
