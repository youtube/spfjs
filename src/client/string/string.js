// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview String manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.string');

goog.require('spf');


/**
 * Checks whether a string contains a given substring.
 *
 * @param {string} str The string to test.
 * @param {string} substr The substring to test for.
 * @return {boolean} True if `str` contains `substr`.
 */
spf.string.contains = function(str, substr) {
  return str.indexOf(substr) != -1;
};


/**
 * Fast prefix-checker.
 *
 * @param {string} str The string to check.
 * @param {string} prefix A string to look for at the start of `str`.
 * @param {number=} opt_offset Offset from index 0 at which to check.
 * @return {boolean} True if `str` begins with `prefix`.
 */
spf.string.startsWith = function(str, prefix, opt_offset) {
  var idx = opt_offset || 0;
  return str.lastIndexOf(prefix, idx) == idx;
};


/**
 * Fast suffix-checker.
 *
 * @param {string} str The string to check.
 * @param {string} suffix A string to look for at the end of `str`.
 * @return {boolean} True if `str` ends with `suffix`.
 */
spf.string.endsWith = function(str, suffix) {
  var l = str.length - suffix.length;
  return l >= 0 && str.indexOf(suffix, l) == l;
};


/**
 * Simple check for if a value is a string.
 *
 * @param {?} val Value to test.
 * @return {boolean} Whether the value is a string.
 */
spf.string.isString = function(val) {
  // When built for the bootloader, optimize for size over complete accuracy.
  if (SPF_BOOTLOADER) {
    // The return value for typeof will be one of the following:
    // * number
    // * string
    // * boolean
    // * function
    // * object
    // * undefined
    // Match "string" to provide an identity test.
    // This test will fail if a string object like "new String()" is passed in,
    // but for the bootloader, this is an acceptable trade off.
    return typeof val == 'string';
  }
  return Object.prototype.toString.call(val) == '[object String]';
};


/**
 * Removes leading and trailing whitespace.
 *
 * @param {string} str The string to trim.
 * @return {string} The trimmed string.
 */
spf.string.trim = (function() {
  if (String.prototype.trim) {
    return function(str) { return str.trim(); };
  } else {
    return function(str) { return str.replace(/^\s+|\s+$/g, ''); };
  }
})();


/**
 * Partitions a string by dividing it at the first occurance of a separator and
 * returning an array of 3 parts: the part before the separator, the separator
 * itself, and the part after the separator.  If the separator is not found,
 * the last two items will be empty strings.
 *
 * @param {string} str The string to partition.
 * @param {string} sep The separator.
 * @return {!Array.<string>} The partitioned string result.
 */
spf.string.partition = function(str, sep) {
  var arr = str.split(sep);
  var nosep = arr.length == 1;
  return [arr[0], (nosep ? '' : sep), (nosep ? '' : arr.slice(1).join(sep))];
};


/**
 * String hash function similar to java.lang.String.hashCode().
 * The hash code for a string is computed as
 * s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
 * where s[i] is the ith character of the string and n is the length of
 * the string. We mod the result to make it between 0 (inclusive) and 2^32
 * (exclusive).
 *
 * @param {string} str A string.
 * @return {number} Hash value for `str`, between 0 (inclusive) and 2^32
 *  (exclusive). The empty string returns 0.
 */
spf.string.hashcode = function(str) {
  str = str || '';
  var result = 0;
  for (var i = 0, l = str.length; i < l; ++i) {
    result = 31 * result + str.charCodeAt(i);
    // Normalize to 4 byte range, 0 ... 2^32.
    result %= 0x100000000;
  }
  return result;
};


/**
 * Converts a string from camelCase to selector-case (e.g. from
 * "multiPartString" to "multi-part-string"), useful for converting JS
 * style and dataset properties to equivalent CSS selectors and HTML keys.
 *
 * @param {string} str The string in camelCase form.
 * @return {string} The string in selector-case form.
 */
spf.string.toSelectorCase = function(str) {
  return String(str).replace(/([A-Z])/g, '-$1').toLowerCase();
};
