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
spf.main.init = function(opt_config) {
  var enable = !!(window.history.pushState);
  var config = opt_config || {};
  for (var key in spf.defaults) {
    var value = (key in config) ? config[key] : spf.defaults[key];
    spf.config[key] = value;
    if (enable && value && spf.string.startsWith(key, 'callback-')) {
      spf.pubsub.subscribe(key, value);
    }
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
  spf.nav.dispose();
  spf.history.dispose();
  spf.pubsub.clear();
  spf.config = {};
};


/**
 * @type {!Object.<string, Function>}
 * @private
 */
spf.main.exports_ = {
  'init': spf.main.init,
  'dispose': spf.main.dispose,
  'navigate': spf.nav.navigate,
  'load': spf.nav.load
};


if (spf.DEBUG) {
  // When SPF is compiled for a development build, all methods are exposed.
  // The methods exported here are for compatibility with production.
  for (var method in spf.main.exports_) {
    window['spf'][method] = spf.main.exports_[method];
  }
} else {
  // When SPF is compiled for a production build, all methods are renamed by
  // the compiler and wrapped in an anonymous function to prevent namespace
  // pollution.  Only the methods exported here will be exposed to the page.
  window['spf'] = spf.main.exports_;
}
