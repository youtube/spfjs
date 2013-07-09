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


// Create the API by exporting aliased functions.
// Core API functions are available on the top-level namespace.
// Extra API functions are available on second-level namespaces.
var api = {
  'init': spf.main.init,
  'dispose': spf.main.dispose,
  'navigate': spf.nav.navigate,
  'load': spf.nav.load,
  'process': spf.nav.process,
  'prefetch': spf.nav.prefetch,
  'scripts': {
    'load': spf.net.scripts.load,
    'unload': spf.net.scripts.unload,
    'ignore': spf.net.scripts.ignore,
    'prefetch': spf.net.scripts.prefetch
  },
  'styles': {
    'load': spf.net.styles.load,
    'unload': spf.net.styles.unload,
    'ignore': spf.net.styles.ignore,
    'prefetch': spf.net.styles.prefetch
  }
};

if (spf.DEBUG) {
  // When compiled for a debug build, allow access to entire namespace.
  window['spf'] = spf;
  for (var key in api) {
    window['spf'][key] = api[key];
  }
} else {
  // When compiled for a production build, isolate access to API functions.
  window['spf'] = api;
}
