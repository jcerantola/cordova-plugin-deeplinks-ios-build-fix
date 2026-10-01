/*
Final iOS entitlements merge.

cordova-plugin-firebasex runs during/after prepare and may regenerate the
configuration-specific Entitlements-*.plist files. Therefore Associated Domains
must be merged once more at before_compile, after all after_prepare hooks have
finished and immediately before Xcode builds/signs the app.
*/

var configParser = require('./lib/configXmlParser.js');
var projectEntitlements = require('./lib/ios/projectEntitlements.js');

module.exports = function(context) {
  if (!context || !context.opts || !context.opts.platforms || context.opts.platforms.indexOf('ios') === -1) {
    return;
  }

  var pluginPreferences = configParser.readPreferences(context);
  if (!pluginPreferences || !pluginPreferences.hosts || pluginPreferences.hosts.length === 0) {
    return;
  }

  projectEntitlements.generateAssociatedDomainsEntitlements(context, pluginPreferences);
  console.log('[cordova-plugin-deeplinks] Final Associated Domains merge completed at before_compile');
};
