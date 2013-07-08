/**
 * @fileoverview Data caching functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.cache');

goog.require('spf');
goog.require('spf.state');


/**
 * Gets data from the cache.  If the data age exceeds the data lifetime,
 * no data is returned.
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
  // Ensure valid data is availabe for the key.
  if (unit && unit['data']) {
    var age = spf.now() - unit['time'];
    // A lifetime of NaN is considered forever; always return the data.
    // If the age is less than the lifetime, return the data.
    if (isNaN(unit['life']) || age < unit['life']) {
      return unit['data'];
    }
  }
  // Otherwise, the data should be removed from the cache.
  spf.cache.remove(key);
};


/**
 * Sets data in the cache.
 *
 * @param {string} key Key for the data object.
 * @param {*} data The data.
 * @param {number=} opt_lifetime Lifetime for the data object.
 *     Defaults to forever if not specified. If a lifetime of less than 1
 *     is specified, the data is not set in the cache.
 */
spf.cache.set = function(key, data, opt_lifetime) {
  var lifetime = parseInt(opt_lifetime, 10);
  if (lifetime <= 0) {
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
    if (!unit || !unit['data']) {
      delete storage[key];
    } else {
      var age = spf.now() - unit['time'];
      // A lifetime of NaN is considered forever; don't remove.
      // If the age is greater than the lifetime, remove.
      if (!isNaN(unit['life']) && age >= unit['life']) {
        delete storage[key];
      }
    }
  }
};


/**
 * @param {*} data The data.
 * @param {number} lifetime Lifetime for the data object.
 * @return {!Object}
 * @private
 */
spf.cache.create_ = function(data, lifetime) {
  return {
    'data': data,
    'life': lifetime,
    'time': spf.now()
  };
};


/**
 * @param {!Object.<string, Object>=} opt_storage Optional storage
 *     object to overwrite the current value.
 * @return {!Object.<string, Object>} Current storage object.
 * @private
 */
spf.cache.storage_ = function(opt_storage) {
  if (opt_storage || !spf.state.has('cache-storage')) {
    return /** @type {!Object.<string, Object>} */ (
        spf.state.set('cache-storage', (opt_storage || {})));
  }
  return /** @type {!Object.<string, Object>} */ (
      spf.state.get('cache-storage'));
};
