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
//
// A general note on browser compatibility.
//
// SPF aims to be broadly compatible with the most common browsers, as long as
// that support does not require an inordinate amount of code.  In addition,
// the primary functionality of SPF -- pushstate-based navigation -- requires
// advanced browser functionality not found in older browsers.  In practice,
// this means that the common library functions are supported in IE 8+, with
// all functions supported in IE 10+.

goog.provide('spf');


/** @define {boolean} Compiler flag to include beta code. */
var SPF_BETA = false;


/** @define {boolean} Compiler flag to build the bootstrap script loader. */
var SPF_BOOTLOADER = false;


/** @define {boolean} Compiler flag to remove development code. */
var SPF_COMPILED = false;


/** @define {boolean} Compiler flag to include debugging code. */
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
  return (new Date()).getTime();
};


/**
 * Type definition for a single SPF response object.
 * - css: HTML string containing <link> and <style> tags of CSS to install.
 * - html: Map of Element IDs to HTML strings containing content with which
 *      to update the Elements.
 * - attr: Map of Element IDs to maps of attibute names to attribute values
 *      to set on the Elements.
 * - js: HTML string containing <script> tags of JS to execute.
 * - title: String of the new Document title.
 * - cacheType: String of the type of caching to use for this response.
 * - timing: Map of timing attributes to timestamp numbers.
 * - redirect: String of a URL to request instead.
 *
 * @typedef {{
 *   css: (string|undefined),
 *   html: (Object.<string, string>|undefined),
 *   attr: (Object.<string, Object.<string, string>>|undefined),
 *   js: (string|undefined),
 *   title: (string|undefined),
 *   cacheType: (string|undefined),
 *   timing: (Object.<string, number>|undefined),
 *   redirect: (string|undefined)
 * }}
 */
spf.SingleResponse;


/**
 * Type definition for a multipart SPF response object.
 * - parts: List of response objects.
 * - cacheType: String of the type of caching to use for this response.
 * - timing: Map of timing attributes to timestamp numbers.
 * - type: The string "multipart".
 *
 * @typedef {{
 *   parts: (Array.<spf.SingleResponse>|undefined),
 *   cacheType: (string|undefined),
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
