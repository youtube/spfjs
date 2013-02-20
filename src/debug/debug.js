/**
 * @fileoverview Debugging and console logging functions.
 * This module is designed to be removed completely by the compiler
 * for production builds.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.debug');

goog.require('spf');


/**
 * Log to the browser console using "debug", the low priority method.  Output
 * using this method will be prefixed with the millisecond duration since
 * start.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.debug = function(var_args) {
  spf.debug.log('debug', arguments);
};


/**
 * Log to the browser console using "info", the medium priority method.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.info = function(var_args) {
  spf.debug.log('info', arguments);
};


/**
 * Log to the browser console using "warn", the high priority method.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.warn = function(var_args) {
  spf.debug.log('warn', arguments);
};


/**
 * Log to the browser console using "error", the critical priority method.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.error = function(var_args) {
  spf.debug.log('error', arguments);
};


/**
 * Log to the browser console the specified method.  If the method does not
 * exist, fallback to using "log" and prefix the message with the intended
 * method.  Note that in the fallback, all logged items will be converted to
 * strings before output for compatibility.
 *
 * @param {string} method The console method to use when logging.
 * @param {Array|Arguments|{length: number}} args List of items to log.
 */
spf.debug.log = function(method, args) {
  if (spf.DEBUG && window.console) {
    args = Array.prototype.slice.call(args, 0);
    var timestamp = spf.now();
    var duration = timestamp - spf.debug.start_;
    if (method == 'debug') {
      args.unshift('  >  ' + duration + 'ms: ');
    }
    if (spf.debug.advanced_) {
      var fnArgs = 'spf_debug_' + timestamp;
      window[fnArgs] = args;
      var fnStr = 'window.console.' + method + '(';
      for (var i = 0, l = args.length; i < l; i++) {
        fnStr += (i > 0) ? ',' : '';
        fnStr += fnArgs + '[' + i + ']';
      }
      fnStr += ')';
      eval('(' + fnStr + ')');
    } else {
      window.console.log(method + ': ' + args.join(' '));
    }
  }
};


/**
 * The timestamp of when debugging was initialize, for logging duration.
 * @type {number}
 * @private
 */
spf.debug.start_ = spf.now();


/**
 * Whether to suppor the advanced console API.
 * @type {boolean}
 * @private
 */
spf.debug.advanced_ = !!(window.console && !eval('/*@cc_on!@*/false'));
