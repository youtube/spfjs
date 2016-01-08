// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Data caching functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.cache');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.state');


/**
 * Gets data from the cache.  If the data age exceeds the data lifetime, no
 * data is returned.
 *
 * If data is successfully returned from cache, the data's moved to the top of
 * the cache, making it less likely to be garbage collected.
 *
 * @param {string} key Key for the data object.
 * @return {*} The data, if it exists.
 */
spf.cache.get = function(key) {
  var storage = spf.cache.storage_();
  if (!(key in storage)) {
    return;
  }
  var unit = storage[key];
  // If the data is valid, return it.
  if (spf.cache.valid_(unit)) {
    spf.cache.updateCount_(unit);
    return unit['data'];
  }
  // Otherwise, the data should be removed from the cache.
  spf.cache.remove(key);
};


/**
 * Sets data in the cache if the both the specified lifetime and the
 * globally configured maximum allow it.
 *
 * @param {string} key Key for the data object.
 * @param {*} data The data.
 * @param {?number=} opt_lifetime Lifetime for the data object.
 *     Defaults to forever if not specified or if null is specified. If a
 *     lifetime of less than 1 is specified, the data is not set in the cache.
 */
spf.cache.set = function(key, data, opt_lifetime) {
  var lifetime = parseInt(opt_lifetime, 10);
  var max = parseInt(spf.config.get('cache-max'), 10);
  if (lifetime <= 0 || max <= 0) {
    return;
  }
  var storage = spf.cache.storage_();
  storage[key] = spf.cache.create_(key, data, lifetime);
  // When setting data in the cache, trigger an asynchronous garbage collection
  // run to prevent unnecessary memory growth.
  setTimeout(spf.cache.collect, 1000);
};


/**
 * Removes data from the cache.
 *
 * @param {string} key Key for the data object.
 */
spf.cache.remove = function(key) {
  var storage = spf.cache.storage_();
  if (key in storage) {
    delete storage[key];
  }
};


/**
 * Removes all data from the cache.
 */
spf.cache.clear = function() {
  spf.cache.storage_({});
};


/**
 * Removes expired data from the cache (aka garbage collection). Invalid data
 * and data with an age exceeding the data lifetime will be removed.
 */
spf.cache.collect = function() {
  var storage = spf.cache.storage_();
  for (var key in storage) {
    var unit = storage[key];
    // If invalid data exists, remove.
    if (!spf.cache.valid_(unit)) {
      delete storage[key];
    }
  }
  // Trim the oldest entries if the cache is still above the max size.
  spf.cache.trim_();
};


// TODO(nicksay): Make count non-optional with next release.
/**
 * Type definition for a SPF cache unit object.
 * - data: The data to cache.
 * - life: Lifetime of the data (milliseconds).
 * - time: Timestamp when the data was stored (milliseconds).
 * - count: The counter for the cached data.
 *
 * @typedef {{
 *   data: *,
 *   life: number,
 *   time: number,
 *   count: number
 * }}
 */
spf.cache.Unit;


/**
 * @param {spf.cache.Unit} unit The cache unit.
 * @return {boolean}
 * @private
 */
spf.cache.valid_ = function(unit) {
  // Ensure valid data is availabe.
  if (!(unit && 'data' in unit)) {
    return false;
  }
  // A lifetime of NaN is considered forever.  If the age is less than the
  // lifetime, then the unit is valid.  Note that if the timestamp is
  // missing, the unit will not be valid.
  var lifetime = unit['life'];
  lifetime = isNaN(lifetime) ? Infinity : lifetime;
  var timestamp = unit['time'];
  var age = spf.now() - timestamp;
  return age < lifetime;
};


/**
 * Trim down the cache units to fit under the cache maximum, based on the
 * lowest count value (oldest entry).
 *
 * @private
 */
spf.cache.trim_ = function() {
  var storage = spf.cache.storage_();
  var max = parseInt(spf.config.get('cache-max'), 10);
  max = isNaN(max) ? Infinity : max;
  var extra = Object.keys(storage).length - max;
  // If the current cache is smaller than the max, no trimming is needed.
  if (extra <= 0) {
    return;
  }

  // Remove the smallest element 'extra' times to trim the cache down to size.
  for (var i = 0; i < extra; i++) {
    var min = {count: Infinity};
    for (var key in storage) {
      if (storage[key].count < min.count) {
        min.key = key;
        min.count = storage[key].count;
      }
    }
    delete storage[min.key];
  }
};


/**
 * @param {string} key Key for the data object.
 * @param {*} data The data.
 * @param {number} lifetime Lifetime for the data object.
 * @return {!spf.cache.Unit}
 * @private
 */
spf.cache.create_ = function(key, data, lifetime) {
  var unit = {'data': data, 'life': lifetime, 'time': spf.now(), 'count': 0};
  spf.cache.updateCount_(unit);
  return unit;
};


/**
 * Update the count of the given unit and the global cache counter to the
 * latest.
 * @param {spf.cache.Unit} unit The cache unit.
 * @private
 */
spf.cache.updateCount_ = function(unit) {
  var count = parseInt(spf.state.get(spf.state.Key.CACHE_COUNTER), 10) || 0;
  count++;
  spf.state.set(spf.state.Key.CACHE_COUNTER, count);

  unit.count = count;
};


/**
 * @param {!Object.<string, spf.cache.Unit>=} opt_storage Optional storage
 *     object to overwrite the current value.
 * @return {!Object.<string, spf.cache.Unit>} Current storage object.
 * @private
 */
spf.cache.storage_ = function(opt_storage) {
  if (opt_storage || !spf.state.has(spf.state.Key.CACHE_STORAGE)) {
    return /** @type {!Object.<string, spf.cache.Unit>} */ (
        spf.state.set(spf.state.Key.CACHE_STORAGE, (opt_storage || {})));
  }
  return /** @type {!Object.<string, spf.cache.Unit>} */ (
      spf.state.get(spf.state.Key.CACHE_STORAGE));
};
