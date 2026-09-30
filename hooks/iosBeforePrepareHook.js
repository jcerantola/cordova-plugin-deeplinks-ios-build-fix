/*
Legacy compatibility hook. cordova-ios 8+ always uses App.xcodeproj/App target,
so there is no app-name-based Xcode project or entitlement file to rename.
*/

var path = require('path');
var fs = require('fs');
var ConfigXmlHelper = require('./lib/configXmlHelper.js');

module.exports = function(ctx) {
  run(ctx);
};

function run(ctx) {
  var projectRoot = ctx.opts.projectRoot;
  var iosProjectFilePath = path.join(projectRoot, 'platforms', 'ios');

  if (fs.existsSync(path.join(iosProjectFilePath, 'App.xcodeproj'))) {
    console.log('cordova-ios 8+ App.xcodeproj detected; skipping legacy entitlements rename hook.');
    return;
  }

  var configXmlHelper = new ConfigXmlHelper(ctx);
  var newProjectName = configXmlHelper.getProjectName();
  var oldProjectName = getOldProjectName(iosProjectFilePath);

  if (!oldProjectName || oldProjectName === newProjectName) return;

  console.log('Project name has changed. Renaming .entitlements file.');

  var oldEntitlementsFilePath = path.join(iosProjectFilePath, oldProjectName, 'Resources', oldProjectName + '.entitlements');
  var newEntitlementsFilePath = path.join(iosProjectFilePath, oldProjectName, 'Resources', newProjectName + '.entitlements');

  if (!fs.existsSync(oldEntitlementsFilePath)) {
    console.log('Legacy entitlements file does not exist; nothing to rename.');
    return;
  }

  try {
    fs.renameSync(oldEntitlementsFilePath, newEntitlementsFilePath);
  } catch (err) {
    console.warn('Failed to rename .entitlements file.');
    console.warn(err);
  }
}

function getOldProjectName(projectDir) {
  var files;
  try {
    files = fs.readdirSync(projectDir);
  } catch (err) {
    return '';
  }

  var projectFile = '';
  files.forEach(function(fileName) {
    if (path.extname(fileName) === '.xcodeproj' && fileName !== 'App.xcodeproj') {
      projectFile = path.basename(fileName, '.xcodeproj');
    }
  });
  return projectFile;
}
