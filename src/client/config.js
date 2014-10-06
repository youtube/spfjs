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
 * Type definition for a SPF config value.
 *
 * Function type temporarily needed for experimental-html-handler.
 * TODO(philharnish): Remove "Function".
 *
 * @typedef {string|number|boolean|Function|null}
 */
spf.config.Value;


/**
 * Default configuration values.
 * @type {!Object.<spf.config.Value>}
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
  'reload-identifier': null,  // Always a param, no '?' needed.
  'request-timeout': 0,  // No request timeout.
  'url-identifier': '?spf=__type__'
};


/**
 * Initialize the configuration with an optional object.  If values are not
 * provided, the defaults are used if they exist.
 *
 * @param {Object.<spf.config.Value>=} opt_config Optional configuration object.
 */
spf.config.init = function(opt_config) {
  var config = opt_config || {};
  // Set primary configs; each has a default.
  for (var key in spf.config.defaults) {
    var value = (key in config) ? config[key] : spf.config.defaults[key];
    spf.config.set(key, value);
  }
  // Set advanced and experimental configs; none have defaults.
  for (var key in config) {
    if (!(key in spf.config.defaults)) {
      spf.config.set(key, config[key]);
    }
  }
};


/**
 * Checks whether a current configuration value exists.
 *
 * @param {string} name The configuration name.
 * @return {boolean} Whether the configuration value exists.
 */
spf.config.has = function(name) {
  return name in spf.config.values;
};


/**
 * Gets a current configuration value.
 *
 * @param {string} name The configuration name.
 * @return {spf.config.Value|undefined} The configuration value.
 */
spf.config.get = function(name) {
  return spf.config.values[name];
};


/**
 * Sets a current configuration value.
 *
 * @param {string} name The configuration name.
 * @param {spf.config.Value} value The configuration value.
 * @return {spf.config.Value} The configuration value.
 */
spf.config.set = function(name, value) {
  spf.config.values[name] = value;
  return value;
};


/**
 * Removes all data from the config.
 */
spf.config.clear = function() {
  for (var key in spf.config.values) {
    delete spf.config.values[key];
  }
};


/**
 * The config storage object.
 * @type {!Object.<spf.config.Value>}
 */
spf.config.values = {};


// Automatic initialization for spf.config.values.
if (!spf.state.has(spf.state.Key.CONFIG_VALUES)) {
  spf.state.set(spf.state.Key.CONFIG_VALUES, spf.config.values);
}
spf.config.values = /** @type {!Object.<spf.config.Value>} */ (
    spf.state.get(spf.state.Key.CONFIG_VALUES));
