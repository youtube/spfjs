// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

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
// stub.js.
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


/** @define {boolean} Compiler flag to build the bootstrap script loader. */
var SPF_BOOTLOADER = false;


/** @define {boolean} Compiler flag to include debugging code. */
var SPF_DEBUG = true;


/** @define {boolean} Compiler flag to include tracing code. */
var SPF_TRACING = false;


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
 * Dispatches a custom event.
 *
 * @param {string} name The custom event name.
 * @param {!Object=} opt_detail The custom event detail (data).
 * @return {boolean} False if the event was canceled.
 */
spf.dispatch = function(name, opt_detail) {
  if (document.createEvent) {
    var evt = document.createEvent('CustomEvent');
    var bubbles = true;
    var cancelable = true;
    evt.initCustomEvent('spf' + name, bubbles, cancelable, opt_detail);
    return document.dispatchEvent(evt);
  }
  return true;
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
 * - url: String of the correct URL for the current request. This will replace
 *      the current URL in history.
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
 *   url: (string|undefined),
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
 * - postData: optional data to send with a request.  Only used if the method
 *       is set to "POST".
 * - onError: optional callback if an error occurs.
 * - onRequest: optional callback when a request will be made.
 * - onPartProcess: optional callback when part of a multipart response
 *       will be processed.
 * - onPartDone: optional callback when part of a multipart response
 *       is done being processed.
 * - onProcess: optional callback when a single response will be processed.
 * - onDone: optional callback when either repsonse is done being processed.
 *
 * @typedef {{
 *   postData: (ArrayBuffer|Blob|Document|FormData|null|string|undefined),
 *   method: (string|undefined),
 *   onError: (function(spf.EventDetail)|undefined),
 *   onRequest: (function(spf.EventDetail)|undefined),
 *   onPartProcess: (function(spf.EventDetail)|undefined),
 *   onPartDone: (function(spf.EventDetail)|undefined),
 *   onProcess: (function(spf.EventDetail)|undefined),
 *   onDone: (function(spf.EventDetail)|undefined)
 * }}
 */
spf.RequestOptions;


/**
 * Type definititon for custom event detail (data), also used for callbacks.
 * - err: optional error that occurred; defined for "error" events
 * - name: optional name of the scripts or styles that will be unloaded;
 *       defined for "jsbeforeunload", "jsunload", "cssbeforeunload",
 *       and "cssunload" events.
 * - part: optional part of a multipart response; defined for "partprocess"
 *       and "partdone" events.
 * - previous: optional URL of the previous page; defined for "history" and
 *       "request" events.
 * - referer: optional URL of the referer page; defined for "history" and
 *       "request" events.
 * - response: optional complete response; defined for "process" and
 *       "done" events.
 * - target: optional target element; defined for "click" events.
 * - url: optional URL of the request; defined for "error", "reload", "click",
 *       "history", "request", "partprocess", "partdone", "process", and "done"
 *       events.
 * - urls: optional list or URLs of scripts/styles to be unloaded; defined for
 *       "jsbeforeunload", "jsunload", "cssbeforeunload", and "cssunload"
 *       events.
 *
 * @typedef {{
 *   err: (Error|undefined),
 *   name: (string|undefined),
 *   part: (spf.SingleResponse|undefined),
 *   previous: (string|undefined),
 *   referer: (string|undefined),
 *   target: (Element|undefined),
 *   response: (spf.SingleResponse|spf.MultipartResponse|undefined),
 *   url: (string|undefined),
 *   urls: (Array.<string>|undefined)
 * }}
 */
spf.EventDetail;
