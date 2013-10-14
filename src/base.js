/**
 * @fileoverview The base SPF functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

// A general note on the SPF framework.
//
// SPF is an independent framework intended to be compiled using the Closure
// Compiler, but it has no dependencies on the Closure Library.  Each file has
// goog.provide and goog.require statements for automatic dependency management
// by the compiler, but these primitives are processed and removed during
// compilation.  For testing and development, these functions are stubbed in
// testing/stub.js.

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
 * Creates a new function that, when called, has its {@code this} set to the
 * provided value, with a given sequence of arguments preceding any provided
 * when the new function is called.
 *
 * @param {?function(this:T, ...)} fn A function to partially apply.
 * @param {T} self Specifies the object which this should point to when the
 *     function is run.
 * @param {...*} var_args Additional arguments that are partially applied to the
 *     function.
 * @return {!Function} A partially-applied form of the function bind() was
 *     invoked on.
 * @template T
 */
spf.bind = function(fn, self, var_args) {
  var args = Array.prototype.slice.call(arguments, 2);
  return function() {
    // Clone the args and append additional ones.
    var newArgs = args.slice();
    newArgs.push.apply(newArgs, arguments);
    return fn.apply(self, newArgs);
  };
};


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
  'animation-class': 'spf-animate',
  'animation-duration': 425,
  'cache-lifetime': 10 * 60 * 1000,  // 10 minute cache lifetime (ms).
  'cache-max': 50,  // 50 items.
  'link-class': 'spf-link',
  'nolink-class': 'spf-nolink',
  'navigate-limit': 20,  // 20 navigations per session.
  'navigate-lifetime': 24 * 60 * 60 * 1000,  // 1 day session lifetime (ms).
  'navigate-requested-callback': null,
  'navigate-part-received-callback': null,
  'navigate-part-processed-callback': null,
  'navigate-received-callback': null,
  'navigate-processed-callback': null,
  'navigate-error-callback': null,
  'process-async': false,
  'request-timeout': 0,  // No request timeout.
  'script-loading-callback': null,
  'style-loading-callback': null,
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


/**
 * Type definition for a single SPF response object.
 * - css: HTML string containing <link> and <style> tags of CSS to install.
 * - html: Map of Element IDs to HTML strings containing content with which
 *      to update the Elements.
 * - attr: Map of Element IDs to maps of attibute names to attribute values
 *      to set on the Elements.
 * - js: HTML string containing <script> tags of JS to execute.
 * - title: String of the new Document title.
 * - timing: Map of timing attributes to timestamp numbers.
 * - redirect: String of a URL to request instead.
 *
 * @typedef {{
 *   css: (string|undefined),
 *   html: (Object.<string, string>|undefined),
 *   attr: (Object.<string, Object.<string, string>>|undefined),
 *   js: (string|undefined),
 *   title: (string|undefined),
 *   timing: (Object.<string, number>|undefined),
 *   redirect: (string|undefined)
 * }}
 */
spf.SingleResponse;


/**
 * Type definition for a multipart SPF response object.
 * - parts: List of response objects.
 * - timing: Map of timing attributes to timestamp numbers.
 * - type: The string "multipart".
 *
 * @typedef {{
 *   parts: (Array.<spf.SingleResponse>|undefined),
 *   timing: (Object.<string, number>|undefined),
 *   type: string
 * }}
 */
spf.MultipartResponse;


/**
 * Type definition for the configuration options for requesting a URL.
 * - method: optional method with which to send the request; defaults to "GET".
 * - onError: optional callback to execute if the request fails. The first
 *       argument is the requested URL; the second argument is the Error that
 *       occurred.
 * - onPart: optional callback to execute upon receiving a part of a multipart
 *       SPF response (see {@link spf.MultipartResponse}).  Called before
 *       {@code onSuccess}, once per part of multipart responses; never called
 *       for single responses. If valid "X-SPF-Response-Type: multipart" and
 *       "Transfer-Encoding: chunked" headers are sent, then this callback will
 *       be executed on-the-fly as chunks are received.  The first argument is
 *       the requested URL; the second is the partial response object.
 * - onSuccess: optional callback to execute if the request succeeds.  The first
 *       argument is the requested URL; the second is the response object.  The
 *       response object will be either a complete single response object or
 *       a complete multipart response object.
 * - postData: optional data to send with a request.  Only used if the method is
 *       set to "POST".
 *
 * @typedef {{
 *   postData: (ArrayBuffer|Blob|Document|FormData|null|string|undefined),
 *   method: (string|undefined),
 *   onError: (function(string, Error)|undefined),
 *   onPart: (function(string, spf.SingleResponse)|undefined),
 *   onSuccess: (function(string,
 *                   (spf.SingleResponse|spf.MultipartResponse))|undefined)
 * }}
 */
spf.RequestOptions;
