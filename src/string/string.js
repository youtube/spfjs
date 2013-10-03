/**
 * @fileoverview String manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.string');


/**
 * Checks whether a string contains a given substring.
 *
 * @param {string} str The string to test.
 * @param {string} substr The substring to test for.
 * @return {boolean} True if {@code str} contains {@code substr}.
 */
spf.string.contains = function(str, substr) {
  return str.indexOf(substr) != -1;
};


/**
 * Fast prefix-checker.
 *
 * @param {string} str The string to check.
 * @param {string} prefix A string to look for at the start of {@code str}.
 * @return {boolean} True if {@code str} begins with {@code prefix}.
 */
spf.string.startsWith = function(str, prefix) {
  return str.lastIndexOf(prefix, 0) == 0;
};


/**
 * Fast suffix-checker.
 *
 * @param {string} str The string to check.
 * @param {string} suffix A string to look for at the end of {@code str}.
 * @return {boolean} True if {@code str} ends with {@code suffix}.
 */
spf.string.endsWith = function(str, suffix) {
  var l = str.length - suffix.length;
  return l >= 0 && str.indexOf(suffix, l) == l;
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
 * String hash function similar to java.lang.String.hashCode().
 * The hash code for a string is computed as
 * s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
 * where s[i] is the ith character of the string and n is the length of
 * the string. We mod the result to make it between 0 (inclusive) and 2^32
 * (exclusive).
 *
 * @param {string} str A string.
 * @return {number} Hash value for {@code str}, between 0 (inclusive) and 2^32
 *  (exclusive). The empty string returns 0.
 */
spf.string.hashCode = function(str) {
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
