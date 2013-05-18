/**
 * @fileoverview The primary SPF entry point.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.main');

goog.require('spf');
goog.require('spf.debug');
goog.require('spf.history');
goog.require('spf.nav');
goog.require('spf.pubsub');
goog.require('spf.string');


/**
 * Initialize SPF.
 *
 * @param {Object=} opt_config Optional configuration object.  Will be merged
 *     with {@link #defaults} and stored in {@link #config}.
 * @return {boolean} Whether SPF was successfully initialized.  If the HTML5
 *     history modification API is not supported, returns false.
 */
spf.main.init = function(opt_config) {
  var enable = !!(window.history.pushState);
  spf.debug.info('main.init ', 'enable=', enable);
  var config = opt_config || {};
  for (var key in spf.defaults) {
    var value = (key in config) ? config[key] : spf.defaults[key];
    spf.config[key] = value;
    if (enable && value && spf.string.endsWith(key, '-callback')) {
      spf.pubsub.subscribe(key, value);
    }
  }
  spf.debug.debug('    config', spf.config);
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
  spf.nav.dispose();
  spf.history.dispose();
  spf.pubsub.clear();
  spf.cache.clear();
  spf.config = {};
};


// Create the external API.
spf.init = spf.main.init;
spf.dispose = spf.main.dispose;
spf.navigate = spf.nav.navigate;
spf.load = spf.nav.load;
spf.process = spf.nav.process;
spf.prefetch = spf.nav.prefetch;
spf.preprocess = spf.nav.preprocess;


// When SPF is compiled for a production build, all methods are renamed by
// the compiler and wrapped in an anonymous function to prevent namespace
// pollution.  Only the methods exported here will be exposed to the page.
if (spf.DEBUG) {
  // When compiled for a debug build, allow access to entire namespace.
  window['spf'] = spf;
} else {
  window['spf'] = {
    'init': spf.init,
    'dispose': spf.dispose,
    'navigate': spf.navigate,
    'load': spf.load,
    'process': spf.process,
    'prefetch': spf.prefetch,
    'preprocess': spf.preprocess
  };
}
