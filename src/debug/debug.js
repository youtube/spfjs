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
 * Log to the browser console using "debug", the low priority method.
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
    var methodLevel = spf.debug.levels_[method];
    var outputLevel = spf.debug.levels_[spf.debug.OUTPUT];
    if (methodLevel < outputLevel) {
      return;
    }
    args = Array.prototype.slice.call(args, 0);
    var timestamp = spf.now();
    var duration = (timestamp - spf.debug.start_) / 1000;
    if (duration.toFixed) {
      duration = duration.toFixed(3);
      while (duration.length < 8) {
        duration = ' ' + duration;
      }
    } else {
      duration = '' + duration;
    }
    args.unshift(duration + 's: ');
    if (spf.debug.advanced_) {
      args.unshift('[spf]');
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
      args.unshift('[spf.' + method + ']');
      window.console.log(args.join(' '));
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


/**
 * A map of logging methods to corresponding output levels.
 * @type {Object.<string, number>}
 * @const
 * @private
 */
spf.debug.levels_ = {
  'debug': 1,
  'info': 2,
  'warn': 3,
  'error': 4
};


/**
 * @define {string} OUTPUT is provided to control the level of output
 * from debugging code.  Valid values correspond to browser console logging
 * functions: "debug", "info", "warn", and "error", and can be set by the
 * compiler when "--define spf.DEBUG_LEVEL='warn'" or similar is specified.
 */
spf.debug.OUTPUT = 'info';
