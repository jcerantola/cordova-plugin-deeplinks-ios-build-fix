#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var SCENE_DELEGATE_PATTERN = /(<key>\s*UISceneDelegateClassName\s*<\/key>\s*<string>)((?:[^<]*?\.)?)SceneDelegate(\s*<\/string>)/g;
var SCENE_DELEGATE_DIAGNOSTIC_PATTERN = /<key>\s*UISceneDelegateClassName\s*<\/key>\s*<string>([^<]*)<\/string>/;

module.exports = function(context) {
  var projectRoot = context.opts.projectRoot;
  var iosPlatformRoot = path.join(projectRoot, 'platforms', 'ios');

  if (!fs.existsSync(iosPlatformRoot)) {
    return;
  }

  var infoPlistPath = findInfoPlist(iosPlatformRoot);
  if (!infoPlistPath) {
    console.warn('[cordova-plugin-deeplinks] Info.plist not found; cold-start SceneDelegate patch skipped.');
    return;
  }

  var original = fs.readFileSync(infoPlistPath, 'utf8');
  var matchCount = 0;
  var patched = original.replace(SCENE_DELEGATE_PATTERN, function(full, prefix, modulePrefix) {
    matchCount++;
    return prefix + modulePrefix + 'AppSceneDelegate</string>';
  });

  if (matchCount === 0) {
    var diagnostic = original.match(SCENE_DELEGATE_DIAGNOSTIC_PATTERN);
    if (diagnostic && /AppSceneDelegate\s*$/.test(diagnostic[1])) {
      return;
    }
    console.warn('[cordova-plugin-deeplinks] Could not patch UISceneDelegateClassName for cold-start support.');
    return;
  }

  fs.writeFileSync(infoPlistPath, patched);
  console.log('[cordova-plugin-deeplinks] Cold-start SceneDelegate enabled in ' + infoPlistPath);
};

function findInfoPlist(iosPlatformRoot) {
  return searchDir(iosPlatformRoot, 3);
}

function searchDir(dir, depth) {
  if (depth < 0) {
    return null;
  }

  var entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return null;
  }

  for (var i = 0; i < entries.length; i++) {
    if (entries[i].isFile() && entries[i].name.endsWith('-Info.plist')) {
      return path.join(dir, entries[i].name);
    }
  }

  for (var j = 0; j < entries.length; j++) {
    var entry = entries[j];
    if (entry.isDirectory() && entry.name !== 'CordovaLib' && entry.name !== 'cordova' && entry.name !== 'Pods') {
      var found = searchDir(path.join(dir, entry.name), depth - 1);
      if (found) {
        return found;
      }
    }
  }

  return null;
}
