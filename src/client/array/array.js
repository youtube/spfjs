// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Array manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.array');

goog.require('spf');


/**
 * @typedef {Array|NodeList|Arguments|{length: number}}
 */
spf.array.ArrayLike;


/**
 * Compatible Array#forEach implementation.
 *
 * @param {Array.<ITEM>|spf.array.ArrayLike} arr The array.
 * @param {?function(this:THIS, ITEM, number, ?) : ?} fn The function to
 *   execute for each item.  The function is executed with three arguments:
 *   the item value, the item index, and the array.
 * @param {THIS=} opt_obj The value to use as "this" in the function.
 * @template THIS, ITEM
 */
spf.array.each = function(arr, fn, opt_obj) {
  // When built for the bootloader, optimize for size over speed.
  if (!SPF_BOOTLOADER && arr.forEach) {
    arr.forEach(fn, opt_obj);
    return;
  }
  for (var i = 0, l = arr.length; i < l; i++) {
    if (i in arr) {
      fn.call(opt_obj, arr[i], i, arr);
    }
  }
};


/**
 * Compatible Array#every implementation.
 *
 * @param {Array.<ITEM>|spf.array.ArrayLike} arr The array.
 * @param {?function(this:THIS, ITEM, number, ?) : boolean} fn The function to
 *   execute for each item.  The function is executed with three arguments:
 *   the item value, the item index, and the array; it should return true
 *   or false.
 * @param {THIS=} opt_obj The value to use as "this" in the function.
 * @return {boolean} Whether the result of every execution was truthy.
 * @template THIS, ITEM
 */
spf.array.every = function(arr, fn, opt_obj) {
  // When built for the bootloader, optimize for size over speed.
  if (!SPF_BOOTLOADER && arr.every) {
    return arr.every(fn, opt_obj);
  }
  for (var i = 0, l = arr.length; i < l; i++) {
    if (i in arr && !fn.call(opt_obj, arr[i], i, arr)) {
      return false;
    }
  }
  return true;
};


/**
 * Compatible Array#some implementation.
 *
 * @param {Array.<ITEM>|spf.array.ArrayLike} arr The array.
 * @param {?function(this:THIS, ITEM, number, ?) : boolean} fn The function to
 *   execute for each item.  The function is executed with three arguments:
 *   the item value, the item index, and the array; it should return true
 *   or false.
 * @param {THIS=} opt_obj The value to use as "this" in the function.
 * @return {boolean} Whether the result of any execution was truthy.
 * @template THIS, ITEM
 */
spf.array.some = function(arr, fn, opt_obj) {
  // When built for the bootloader, optimize for size over speed.
  if (!SPF_BOOTLOADER && arr.some) {
    return arr.some(fn, opt_obj);
  }
  for (var i = 0, l = arr.length; i < l; i++) {
    if (i in arr && fn.call(opt_obj, arr[i], i, arr)) {
      return true;
    }
  }
  return false;
};


/**
 * Compatible Array#filter implementation.
 *
 * @param {Array.<ITEM>|spf.array.ArrayLike} arr The array.
 * @param {?function(this:THIS, ITEM, number, ?) : RESULT} fn The function to
 *   execute for each item.  The function is executed with three arguments:
 *   the item value, the item index, and the array; it should return the
 *   new result.
 * @param {THIS=} opt_obj The value to use as "this" in the function.
 * @return {!Array.<RESULT>} A new array of filtered results.
 * @template THIS, ITEM, RESULT
 */
spf.array.filter = function(arr, fn, opt_obj) {
  // When built for the bootloader, optimize for size over speed.
  if (!SPF_BOOTLOADER && arr.filter) {
    return arr.filter(fn, opt_obj);
  }
  var res = [];
  spf.array.each(arr, function(a, i, arr) {
    if (fn.call(opt_obj, a, i, arr)) {
      res.push(a);
    }
  });
  return res;
};


/**
 * Compatible Array#indexOf implementation.
 *
 * @param {Array.<ITEM>|spf.array.ArrayLike} arr The array.
 * @param {ITEM} val The value to find.
 * @param {number=} opt_fromIndex The starting index to search from.
 * @return {number} The index of the first matching element.
 * @template ITEM
 */
spf.array.indexOf = function(arr, val, opt_fromIndex) {
  if (!SPF_BOOTLOADER && arr.indexOf) {
    return arr.indexOf(val, opt_fromIndex);
  }
  var start = opt_fromIndex || 0;
  for (var i = start; i < arr.length; i++) {
    if (i in arr && arr[i] === val) {
      return i;
    }
  }
  return -1;
};


/**
 * Compatible Array#map implementation.
 *
 * @param {Array.<ITEM>|spf.array.ArrayLike} arr The array.
 * @param {?function(this:THIS, ITEM, number, ?) : RESULT} fn The function to
 *   execute for each item.  The function is executed with three arguments:
 *   the item value, the item index, and the array; it should return the
 *   new result.
 * @param {THIS=} opt_obj The value to use as "this" in the function.
 * @return {Array.<RESULT>} A new array of mapped results.
 * @template THIS, ITEM, RESULT
 */
spf.array.map = function(arr, fn, opt_obj) {
  // When built for the bootloader, optimize for size over speed.
  if (!SPF_BOOTLOADER && arr.map) {
    return arr.map(fn, opt_obj);
  }
  var res = [];
  res.length = arr.length;
  spf.array.each(arr, function(a, i, arr) {
    res[i] = fn.call(opt_obj, a, i, arr);
  });
  return res;
};


/**
 * Converts to an array if needed.
 *
 * @param {?} val The value.
 * @return {Array} An array.
 */
spf.array.toArray = function(val) {
  return spf.array.isArray(val) ? val : [val];
};


/**
 * Simple Array.isArray implementation.
 *
 * @param {?} val Value to test.
 * @return {boolean} Whether the value is an array.
 */
spf.array.isArray = function(val) {
  // When built for the bootloader, optimize for size over complete accuracy.
  if (SPF_BOOTLOADER) {
    // This test will fail if a fake object like "{push: 1}" is passed in, but
    // for the bootloader, this is an acceptable trade off.
    return !!(val && val.push);
  }
  return Object.prototype.toString.call(val) == '[object Array]';
};
