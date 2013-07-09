/**
 * @fileoverview The primary SPF entry point.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.main');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.history');
goog.require('spf.nav');
goog.require('spf.net.scripts');
goog.require('spf.net.styles');
goog.require('spf.pubsub');


/**
 * Initialize SPF.
 *
 * @param {Object=} opt_config Optional configuration object.
 * @return {boolean} Whether SPF was successfully initialized.  If the HTML5
 *     history modification API is not supported, returns false.
 */
spf.main.init = function(opt_config) {
  var enable = !!(window.history.pushState);
  spf.debug.info('main.init ', 'enable=', enable);
  var config = opt_config || {};
  for (var key in spf.config.defaults) {
    var value = (key in config) ? config[key] : spf.config.defaults[key];
    spf.config.set(key, value);
  }
  if (enable) {
    spf.history.init(spf.nav.handleHistory);
    spf.nav.init();
  }
  return enable;
};


/**
 * Dispose SPF.
 */
spf.main.dispose = function() {
  var enable = !!(window.history.pushState);
  if (enable) {
    spf.nav.dispose();
    spf.history.dispose();
  }
  spf.config.clear();
};


// When SPF is compiled for a production build, all methods are renamed by
// the compiler and wrapped in an anonymous function to prevent namespace
// pollution.  Only the methods exported here will be exposed to the page.
if (spf.DEBUG) {
  // When compiled for a debug build, allow access to entire namespace.
  window['spf'] = spf;
} else {
  // When compiled for a production build, isolate access to API functions.
  window['spf'] = {};
}
// Create the API by exporting aliased functions.
// Core API functions are available on the top-level namespace.
window['spf']['init'] = spf.main.init;
window['spf']['dispose'] = spf.main.dispose;
window['spf']['navigate'] = spf.nav.navigate;
window['spf']['load'] = spf.nav.load;
window['spf']['process'] = spf.nav.process;
window['spf']['prefetch'] = spf.nav.prefetch;
// Extra API functions are on second-level namespaces.
window['spf']['scripts'] = {
  'load': spf.net.scripts.load,
  'unload': spf.net.scripts.unload,
  'ignore': spf.net.scripts.ignore,
  'prefetch': spf.net.scripts.prefetch
};
window['spf']['styles'] = {
  'load': spf.net.styles.load,
  'unload': spf.net.styles.unload,
  'ignore': spf.net.styles.ignore,
  'prefetch': spf.net.styles.prefetch
};
