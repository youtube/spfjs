/**
 * @fileoverview Data caching functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.cache');

goog.require('spf');
goog.require('spf.state');
goog.require('spf.config');


/**
 * Gets data from the cache.  If the data age exceeds the data lifetime or
 * the globally configured maximum, no data is returned.
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
  storage[key] = spf.cache.create_(data, lifetime);
  // When setting data in the cache, trigger an asynchronous garbage collection
  // run to prevent unnecessary memory growth.
  setTimeout(spf.cache.collect, 1000);
};


/**
 * Removes data from the cache.
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
 *   count: (number|undefined)
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
  // A max of NaN is considered infinite.  If the count is less than the max,
  // then the unit is valid.
  var max = /** @type {number} */ (spf.config.get('cache-max'));
  max = isNaN(max) ? Infinity : max;
  var current = /** @type {number} */ ((spf.state.get('cache-counter') || 0));
  var count = current - (unit['count'] || 0);
  // Both a valid age and count are required.
  return (age < lifetime) && (count < max);
};


/**
 * @param {*} data The data.
 * @param {number} lifetime Lifetime for the data object.
 * @return {!spf.cache.Unit}
 * @private
 */
spf.cache.create_ = function(data, lifetime) {
  var count = /** @type {number} */ (
      (spf.state.get('cache-counter') || 0)) + 1;
  spf.state.set('cache-counter', count);
  return {'data': data, 'life': lifetime, 'time': spf.now(), 'count': count};
};


/**
 * @param {!Object.<string, spf.cache.Unit>=} opt_storage Optional storage
 *     object to overwrite the current value.
 * @return {!Object.<string, spf.cache.Unit>} Current storage object.
 * @private
 */
spf.cache.storage_ = function(opt_storage) {
  if (opt_storage || !spf.state.has('cache-storage')) {
    return /** @type {!Object.<string, spf.cache.Unit>} */ (
        spf.state.set('cache-storage', (opt_storage || {})));
  }
  return /** @type {!Object.<string, spf.cache.Unit>} */ (
      spf.state.get('cache-storage'));
};
