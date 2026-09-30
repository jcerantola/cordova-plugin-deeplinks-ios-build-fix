/*
Script activates support for Universal Links in the application by setting proper preferences in the xcode project file.
Which is:
- deployment target set to iOS 9.0
- .entitlements file added to project PBXGroup and PBXFileReferences section
- path to .entitlements file added to Code Sign Entitlements preference
*/

var path = require('path');
var compare = require('node-version-compare');
var ConfigXmlHelper = require('../configXmlHelper.js');
var IOS_DEPLOYMENT_TARGET = '8.0';
var COMMENT_KEY = /_comment$/;
var context;

module.exports = {
  enableAssociativeDomainsCapability: enableAssociativeDomainsCapability
}

// region Public API

function enableAssociativeDomainsCapability(cordovaContext) {
  context = cordovaContext;
  var projectFile = loadProjectFile();
  activateAssociativeDomains(projectFile.xcode);
  addPbxReference(projectFile.xcode);
  projectFile.write();
}

// endregion

// region Alter project file preferences

function activateAssociativeDomains(xcodeProject) {
  var configurations = nonComments(xcodeProject.pbxXCBuildConfigurationSection());
  var entitlementsFilePath = pathToEntitlementsFile();
  var config;
  var buildSettings;
  var deploymentTargetIsUpdated;

  for (config in configurations) {
    buildSettings = configurations[config].buildSettings;
    buildSettings['CODE_SIGN_ENTITLEMENTS'] = '"' + entitlementsFilePath + '"';

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

  console.log('IOS project Code Sign Entitlements now set to: ' + entitlementsFilePath);
}

// endregion

// region PBXReference methods

function addPbxReference(xcodeProject) {
  var fileReferenceSection = nonComments(xcodeProject.pbxFileReferenceSection());
  var entitlementsFileName = path.basename(pathToEntitlementsFile());

  if (isPbxReferenceAlreadySet(fileReferenceSection, entitlementsFileName)) {
    console.log('Entitlements file is in reference section.');
    return;
  }

  console.log('Entitlements file is not in references section, adding it');
  xcodeProject.addResourceFile(entitlementsFileName);
}

function isPbxReferenceAlreadySet(fileReferenceSection, entitlementsRelativeFilePath) {
  var isAlreadyInReferencesSection = false;
  var uuid;
  var fileRefEntry;

  for (uuid in fileReferenceSection) {
    fileRefEntry = fileReferenceSection[uuid];
    if (fileRefEntry.path && fileRefEntry.path.indexOf(entitlementsRelativeFilePath) > -1) {
      isAlreadyInReferencesSection = true;
      break;
    }
  }

  return isAlreadyInReferencesSection;
}

// region Xcode project file helpers

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
        'xcode': xcodeproj,
        write: function () {
          var fs = require('fs');
          var frameworks_file = path.join(iosPlatformPath(), 'frameworks.json');
          var frameworks = {};
          try {
            frameworks = context.requireCordovaModule(frameworks_file);
          } catch (e) { }

          fs.writeFileSync(pbxPath, xcodeproj.writeSync());
          if (Object.keys(frameworks).length === 0) {
            // shelljs is not guaranteed to be available in modern Cordova.
            // frameworks.json is a file, so native fs is sufficient here.
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

// endregion

// region Path helpers

function iosPlatformPath() {
  return path.join(projectRoot(), 'platforms', 'ios');
}

function projectRoot() {
  return context.opts.projectRoot;
}

function pathToEntitlementsFile() {
  // cordova-ios 8 always creates App.xcodeproj and keeps the native source
  // directory named App, independently of the application's display name.
  var projectFiles = require('glob').globSync(path.join(iosPlatformPath(), '*.xcodeproj'));
  if (projectFiles.some(function(projectFile) { return path.basename(projectFile) === 'App.xcodeproj'; })) {
    return path.join('App', 'Resources', 'App.entitlements');
  }

  var configXmlHelper = new ConfigXmlHelper(context),
    projectName = configXmlHelper.getProjectName(),
    fileName = projectName + '.entitlements';

  return path.join(projectName, 'Resources', fileName);
}

// endregion
