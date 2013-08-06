/**
 * @fileoverview The base SPF functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf');
goog.provide('spf.config');
goog.provide('spf.state');


/**
 * @define {boolean} SPF_COMPILED is provided as a flag so that development code
 * that should not be included in either a debug or production build can be
 * easily removed by the compiler when "--define SPF_COMPILED=true" is
 * specified (e.g. making extra functions beyond the API globally available).
 * To use, place development code inside an "if (!SPF_COMPILED)" conditional.
 */
var SPF_COMPILED = false;


/**
 * @define {boolean} SPF_DEBUG is provided as a flag so that debugging code
 * that should not be included in a production build can be easily removed
 * by the compiler when "--define SPF_DEBUG=false" is specified.  To use,
 * place debugging code inside an "if (SPF_DEBUG)" conditional.
 */
var SPF_DEBUG = true;


/**
 * Executes a function inside a try/catch to gracefully handle failures.
 *
 * @param {Function} fn Function to be executed.
 * @param {...*} var_args Arguments to apply to the function.
 * @return {*} The function result or Error if execution failed.
 */
spf.execute = function(fn, var_args) {
  if (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    try {
      return fn.apply(null, args);
    } catch (err) {
      return err;
    }
  }
};


/**
 * Gets the current timestamp.
 *
 * @return {number} An integer value representing the number of milliseconds
 *     between midnight, January 1, 1970 and the current time.
 */
spf.now = function() {
  // Unary plus operator converts its operand to a number which in the case of
  // a date is done by calling getTime().
  return +new Date();
};


/**
 * Gets a unique key for an object.  Mutates the object to store the key so
 * that multiple calls for the same object will return the same key.
 *
 * @param {Object} obj The object to get a unique key for.
 * @return {string} The unique key.
 */
spf.key = function(obj) {
  var uid = (parseInt(spf.state.get('uid'), 10) || 0) + 1;
  return obj['spf-key'] || (obj['spf-key'] = '' + spf.state.set('uid', uid));
};


/**
 * Default configuration values.
 * @type {Object.<string, string|number|Function>}
 */
spf.config.defaults = {
  'cache-lifetime': 600000,  // 10 minutes in milliseconds.
  'cache-max': 50,  // 50 items.
  'link-class': 'spf-link',
  'nolink-class': 'spf-nolink',
  'navigate-limit': 20,  // 20 navigations per session.
  'navigate-requested-callback': null,
  'navigate-received-callback': null,
  'navigate-processed-callback': null,
  'navigate-error-callback': null,
  'request-timeout': 0,  // No request timeout.
  'script-loading-callback': null,
  'style-loading-callback': null,
  'transition-class': 'spf-transition',
  'transition-duration': 425,
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


/**
 * Checks whether a current state value exists.
 *
 * @param {string} name The state name.
 * @return {boolean} Whether the state value exists.
 */
spf.state.has = function(name) {
  return name in spf.state.values_;
};


/**
 * Gets a current state value.
 *
 * @param {string} name The state name.
 * @return {*} The state value.
 */
spf.state.get = function(name) {
  return spf.state.values_[name];
};


/**
 * Sets a current state value.
 *
 * @param {string} name The state name.
 * @param {*} value The state value.
 * @return {*} The state value.
 */
spf.state.set = function(name, value) {
  spf.state.values_[name] = value;
  return value;
};


/**
 * Current state values.  Globally exported to maintain continuity
 * across revisions.
 * @private {Object}
 */
spf.state.values_ = window['_spf_state'] || {};
window['_spf_state'] = spf.state.values_;
