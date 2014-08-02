// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for handling the SPF config.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.config');

goog.require('spf.state');


/**
 * Default configuration values.
 * @type {Object.<string, string|number|Function>}
 */
spf.config.defaults = {
  'animation-class': 'spf-animate',
  'animation-duration': 425,
  'cache-lifetime': 10 * 60 * 1000,  // 10 minute cache lifetime (ms).
  'cache-max': 50,  // 50 items.
  'cache-unified': false,
  'link-class': 'spf-link',
  'nolink-class': 'spf-nolink',
  'navigate-limit': 20,  // 20 navigations per session.
  'navigate-lifetime': 24 * 60 * 60 * 1000,  // 1 day session lifetime (ms).
  'process-async': false,
  'request-timeout': 0,  // No request timeout.
  'url-identifier': '?spf=__type__'
};


/**
 * Checks whether a current configuration value exists.
 *
 * @param {string} name The configuration name.
 * @return {boolean} Whether the configuration value exists.
 */
spf.config.has = function(name) {
  var config = spf.config.config_();
  return name in config;
};


/**
 * Gets a current configuration value.
 *
 * @param {string} name The configuration name.
 * @return {*} The configuration value.
 */
spf.config.get = function(name) {
  var config = spf.config.config_();
  return config[name];
};


/**
 * Sets a current configuration value.
 *
 * @param {string} name The configuration name.
 * @param {*} value The configuration value.
 * @return {*} The configuration value.
 */
spf.config.set = function(name, value) {
  var config = spf.config.config_();
  config[name] = value;
  return value;
};


/**
 * Removes all data from the config.
 */
spf.config.clear = function() {
  spf.config.config_({});
};


/**
 * @param {!Object.<string, *>=} opt_config Optional config
 *     object to overwrite the current value.
 * @return {!Object.<string, *>} Current config object.
 * @private
 */
spf.config.config_ = function(opt_config) {
  if (opt_config || !spf.state.has('config')) {
    return /** @type {!Object.<string, *>} */ (
        spf.state.set('config', (opt_config || {})));
  }
  return /** @type {!Object.<string, *>} */ (
      spf.state.get('config'));
};
