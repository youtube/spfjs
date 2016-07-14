// Copyright 2012 Google Inc. All rights reserved.
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
 * Creates a new function that, when called, has its `this` set to the
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
 * @param {spf.EventName} name The custom event name.
 * @param {!Object=} opt_detail The custom event detail (data).
 * @return {boolean} False if the event was canceled.
 */
spf.dispatch = function(name, opt_detail) {
  if (document.createEvent) {
    var evt = document.createEvent('CustomEvent');
    var bubbles = true;
    var cancelable = true;
    evt.initCustomEvent(name, bubbles, cancelable, opt_detail);
    return document.dispatchEvent(evt);
  }
  return true;
};


/**
 * Gets the current timestamp.
 *
 * @return {number} A value representing the number of milliseconds
 *     between midnight, January 1, 1970 and the current time.  On browsers
 *     that support DOMHighResTimestamp, this value is a floating point number;
 *     otherwise, it is an integer.
 */
spf.now = (function() {
  if (window.performance && window.performance.timing &&
      window.performance.now) {
    return function() {
      return (window.performance.timing.navigationStart +
              window.performance.now());
    };
  }
  return function() {
    return (new Date()).getTime();
  };
})();


/**
 * Gets a UID.
 *
 * @return {number} A unique number.
 */
spf.uid = function() {
  // Special case to not use spf.state directly to avoid circular dependencies.
  var state = (window['_spf_state'] = window['_spf_state'] || {});
  var uid = parseInt(state['uid'], 10) || 0;
  uid++;
  return (state['uid'] = uid);
};


/**
 * An empty no-op function.
 */
spf.nullFunction = function() {};


/**
 * @enum {string}
 */
spf.EventName = {
  CLICK: 'spfclick',
  CSS_BEFORE_UNLOAD: 'spfcssbeforeunload',
  CSS_UNLOAD: 'spfcssunload',
  DONE: 'spfdone',
  ERROR: 'spferror',
  HISTORY: 'spfhistory',
  JS_BEFORE_UNLOAD: 'spfjsbeforeunload',
  JS_UNLOAD: 'spfjsunload',
  PART_DONE: 'spfpartdone',
  PART_PROCESS: 'spfpartprocess',
  PROCESS: 'spfprocess',
  READY: 'spfready',
  RELOAD: 'spfreload',
  REQUEST: 'spfrequest'
};


/** Type definition for a parsed script resource in a SPF response fragment.
 *
 * @typedef {{
 *   url: (string|undefined),
 *   text: (string|undefined),
 *   name: (string|undefined),
 *   async: (boolean|undefined)
 * }}
 */
spf.ScriptResource;


/** Type definition for a parsed style resource in a SPF response fragment.
 *
 * @typedef {{
 *   url: (string|undefined),
 *   text: (string|undefined),
 *   name: (string|undefined)
 * }}
 */
spf.StyleResource;


/** Type definition for a parsed link resource in a SPF response fragment.
 *
 * @typedef {{
 *   url: (string|undefined),
 *   rel: (string|undefined)
 * }}
 */
spf.LinkResource;


/**
 * Type definition for a fragment of a SPF response.  Either a string of HTML or
 * an object with the resources parsed out of the HTML.
 *
 * @typedef {string|{
 *   html: (string|undefined),
 *   scripts: (Array.<spf.ScriptResource>|undefined),
 *   styles: (Array.<spf.StyleResource>|undefined),
 *   links: (Array.<spf.LinkResource>|undefined)
 * }}
 */
spf.ResponseFragment;


/**
 * Type definition for a single SPF response object.
 * - attr: Map of Element IDs to maps of attibute names to attribute values
 *       to set on the Elements.
 * - body: Map of Element IDs to HTML strings containing content with which
 *       to update the Elements.
 * - cacheKey: Key used to cache this response.
 * - cacheType: String of the type of caching to use for this response.
 * - foot: HTML string containing <script> tags of JS to execute.
 * - head: HTML string containing <link> and <style> tags of CSS to install.
 * - name: String of the general name of this type of response. This will be
 *       used to generate "from" and "to" CSS classes for animation.
 * - redirect: String of a URL to request instead.
 * - reload: Boolean to indicate the page should be reloaded.
 * - timing: Map of timing attributes to timestamp numbers.
 * - title: String of the new Document title.
 * - url: String of the correct URL for the current request. This will replace
 *       the current URL in history.
 *
 * @typedef {{
 *   attr: (Object.<string, Object.<string, string>>|undefined),
 *   body: (Object.<string, spf.ResponseFragment>|undefined),
 *   cacheKey: (string|undefined),
 *   cacheType: (string|undefined),
 *   foot: (spf.ResponseFragment|undefined),
 *   head: (spf.ResponseFragment|undefined),
 *   name: (string|undefined),
 *   redirect: (string|undefined),
 *   reload: (boolean|undefined),
 *   timing: (Object.<string, number>|undefined),
 *   title: (string|undefined),
 *   url: (string|undefined)
 * }}
 */
spf.SingleResponse;


/**
 * Type definition for a multipart SPF response object.
 * - cacheKey: Key used to cache this response.
 * - cacheType: String of the type of caching to use for this response.
 * - parts: List of response objects.
 * - timing: Map of timing attributes to timestamp numbers.
 * - type: The string "multipart".
 *
 * @typedef {{
 *   cacheKey: (string|undefined),
 *   cacheType: (string|undefined),
 *   parts: (Array.<spf.SingleResponse>|undefined),
 *   timing: (Object.<string, number>|undefined),
 *   type: string
 * }}
 */
spf.MultipartResponse;


/**
 * Type definition for the configuration options for requesting a URL.
 * - headers: optional map of headers to send with the request.
 * - method: optional method with which to send the request; defaults to "GET".
 * - onDone: optional callback when either repsonse is done being processed.
 * - onError: optional callback if an error occurs.
 * - onPartDone: optional callback when part of a multipart response is done
 *       being processed.
 * - onPartProcess: optional callback when part of a multipart response will be
 *       pocessed.
 * - onProcess: optional callback when a single response will be processed.
 * - onRequest: optional callback when a request will be made.
 * - postData: optional data to send with a request.  Only used if the method
 *       is set to "POST".
 * - withCredentials: optional flag to send credentials if true.
 *
 * @typedef {{
 *   headers: (Object.<string>|undefined),
 *   method: (string|undefined),
 *   onDone: (function(spf.EventDetail)|undefined),
 *   onError: (function(spf.EventDetail)|undefined),
 *   onPartDone: (function(spf.EventDetail)|undefined),
 *   onPartProcess: (function(spf.EventDetail)|undefined),
 *   onProcess: (function(spf.EventDetail)|undefined),
 *   onRequest: (function(spf.EventDetail)|undefined),
 *   postData: (ArrayBuffer|Blob|Document|FormData|null|string|undefined),
 *   withCredentials: (boolean|undefined)
 * }}
 */
spf.RequestOptions;


/**
 * Type definition for custom event detail (data), also used for callbacks.
 * - err: optional error that occurred; defined for "error" events
 * - name: optional name of the script or stylesheet that will be unloaded;
 *       defined for "jsbeforeunload", "jsunload", "cssbeforeunload",
 *       and "cssunload" events.
 * - part: optional part of a multipart response; defined for "partprocess"
 *       and "partdone" events.
 * - previous: optional URL of the previous page; defined for "history" and
 *       "request" events.
 * - reason: optional reason code and text; defined for the "reload" event.
 * - referer: optional URL of the referer page; defined for "history" and
 *       "request" events.
 * - response: optional complete response; defined for "process" and
 *       "done" events.
 * - target: optional target element; defined for "click" events.
 * - url: optional URL of the request; defined for "error", "reload", "click",
 *       "history", "request", "partprocess", "partdone", "process", and "done"
 *       events - or - optional URL of the script/stylesheet that will be
 *       unloaded; defined for "jsbeforeunload", "jsunload", "cssbeforeunload",
 *       and "cssunload" events.
 *
 * @typedef {{
 *   err: (Error|undefined),
 *   name: (string|undefined),
 *   part: (spf.SingleResponse|undefined),
 *   previous: (string|undefined),
 *   reason: (string|undefined),
 *   referer: (string|undefined),
 *   target: (Element|undefined),
 *   response: (spf.SingleResponse|spf.MultipartResponse|undefined),
 *   url: (string|undefined)
 * }}
 */
spf.EventDetail;


/**
 * Type definition for a task scheduler optionally used by spf.tasks.
 * - addTask: Function to add a new task to the scheduler. It returns a key
 *       which can be used to cancel its execution.
 * - cancelTask: Function which cancels a previously scheduled task.
 *
 * @typedef {{
 *   addTask: (function(!Function): number),
 *   cancelTask: (function(number))
 * }}
 */
spf.TaskScheduler;
