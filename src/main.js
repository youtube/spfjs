// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview The primary SPF entry point.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.main');

goog.require('spf');
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
spf.init = function(opt_config) {
  if (!window.history.pushState) {
    return false;
  }
  var config = opt_config || {};
  for (var key in spf.defaults) {
    var value = (key in config) ? config[key] : spf.defaults[key];
    spf.config[key] = value;
    if (value && spf.string.startsWith(key, 'callback-')) {
      spf.pubsub.subscribe(key, value);
    }
  }
  spf.history.init(spf.nav.handleNavigate);
  spf.nav.init();
  return true;
};


/**
 * Dispose SPF.
 */
spf.dispose = function() {
  spf.nav.dispose();
  spf.history.dispose();
  spf.pubsub.clear();
  spf.config = {};
};


// Exports
if (!spf.DEBUG) {
  // When SPF is compiled for a production build, all methods are renamed by
  // the compiler and wrapped in an anonymous function to prevent namespace
  // pollution.  Only methods exported here will be exposed to the page.
  window['spf'] = {
    'init': spf.init,
    'dispose': spf.dispose
  };
}
