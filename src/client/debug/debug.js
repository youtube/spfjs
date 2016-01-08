// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

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
  if (spf.debug.isLevelEnabled(spf.debug.Level.DEBUG)) {
    spf.debug.log(spf.debug.Level.DEBUG, 'spf', arguments);
  }
};


/**
 * Log to the browser console using "info", the medium priority method.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.info = function(var_args) {
  if (spf.debug.isLevelEnabled(spf.debug.Level.INFO)) {
    spf.debug.log(spf.debug.Level.INFO, 'spf', arguments);
  }
};


/**
 * Log to the browser console using "warn", the high priority method.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.warn = function(var_args) {
  if (spf.debug.isLevelEnabled(spf.debug.Level.WARN)) {
    spf.debug.log(spf.debug.Level.WARN, 'spf', arguments);
  }
};


/**
 * Log to the browser console using "error", the critical priority method.
 *
 * @param {...*} var_args Items to log.
 */
spf.debug.error = function(var_args) {
  if (spf.debug.isLevelEnabled(spf.debug.Level.ERROR)) {
    spf.debug.log(spf.debug.Level.ERROR, 'spf', arguments);
  }
};


/**
 * Log to the browser console the specified method.  If the method does not
 * exist, fallback to using "log" and prefix the message with the intended
 * method.  Note that in the fallback, all logged items will be converted to
 * strings before output for compatibility.
 *
 * @param {string} method The console method to use when logging.
 * @param {string} prefix The string prefix to prepend to the logged items.
 * @param {{length: number}} args List of items to log.
 */
spf.debug.log = function(method, prefix, args) {
  if (!SPF_DEBUG || !window.console) {
    return;
  }
  args = Array.prototype.slice.call(args);
  var current = spf.now();
  var overall = spf.debug.formatDuration(spf.debug.start_, current);
  if (spf.debug.split_) {
    var split = spf.debug.formatDuration(spf.debug.split_, current);
    args.unshift(overall + '/' + split + ':');
  } else {
    args.unshift(overall + ':');
  }
  if (spf.debug.direct_) {
    args.unshift('[' + prefix + ']');
    // Note that passing null for execution context throws an Error in Chrome.
    window.console[method].apply(window.console, args);
  } else {
    args.unshift('[' + prefix + ' - ' + method + ']');
    window.console.log(args.join(' '));
  }
};


/**
 * Reset the timer used for logging duration.  Call to log split times
 * since last reset in addition to overall duration.
 */
spf.debug.reset = function() {
  spf.debug.split_ = spf.now();
};


/**
 * Formats two millisecond timestamps into a duration string.
 * See {@link spf.now} for timestamp generation.
 *
 * @param {number} start The starting millisecond timestamp.
 * @param {number} end The ending millisecond timestamp.
 * @return {string} The formatted duration string.
 */
spf.debug.formatDuration = function(start, end) {
  var dur = (end - start) / 1000;
  if (dur.toFixed) {
    dur = dur.toFixed(3);
  }
  return dur + 's';
};


/**
 * Checks whether a logging level is enabled for output.
 *
 * @param {spf.debug.Level} level The logging level.
 * @return {boolean} True if the logging level is enabled.
 */
spf.debug.isLevelEnabled = function(level) {
  return (spf.debug.levels_[level] >= spf.debug.levels_[spf.debug.OUTPUT]);
};


/**
 * The timestamp of when debugging was initialized, for overall duration.
 * @private {number}
 */
spf.debug.start_ = spf.now();


/**
 * The timestamp of when debugging was reset, for split durations.
 * @private {number}
 */
spf.debug.split_ = 0;


/**
 * Whether to support direct console logging.  This mode allows logging of
 * objects directly to the console without casting to a string.
 * Note: IE does not support direct logging, but also does not support the
 * debug method, so this property will be false in IE.
 * @private {boolean}
 */
spf.debug.direct_ = !!(window.console && window.console.debug);


/**
 * A map of logging output levels to corresponding numeric values.
 * @private {Object.<string, number>}
 * @const
 */
spf.debug.levels_ = {
  'debug': 1,
  'info': 2,
  'warn': 3,
  'error': 4
};


/**
 * The level of logging output, corresponding to browser console logging
 * functions: "debug", "info", "warn", "error".
 * @enum {string}
 */
spf.debug.Level = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};


/**
 * @define {string} OUTPUT is provided to control the level of output
 * from debugging code.  Valid values correspond to browser console logging
 * functions: "debug", "info", "warn", and "error", and can be set by the
 * compiler when "--define spf.debug.OUTPUT='warn'" or similar is specified.
 */
spf.debug.OUTPUT = 'debug';
