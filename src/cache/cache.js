// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview Data caching functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.cache');

goog.require('spf');


/**
 * Gets data from the cache.  If the data age exceeds the data lifetime,
 * no data is returned.
 *
 * @param {string} key Key for the data object.
 * @return {*} The data, if it exists.
 */
spf.cache.get = function(key) {
  if (!spf.cache.storage_ || !(key in spf.cache.storage_)) {
    return;
  }
  var unit = spf.cache.storage_[key];
  // Ensure valid data is availabe for the key.
  if (unit && unit.data) {
    var age = spf.now() - unit.timestamp;
    // A lifetime of NaN is considered forever; always return the data.
    // If the age is less than the lifetime, return the data.
    if (isNaN(unit.lifetime) || age < unit.lifetime) {
      return unit.data;
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
  if (!spf.cache.storage_) {
    spf.cache.storage_ = {};
  }
  var lifetime = parseInt(opt_lifetime, 10);
  if (lifetime <= 0) {
    return;
  }
  spf.cache.storage_[key] = new spf.cache.Unit(data, lifetime);
  // When setting data in the cache, trigger an asynchronous garbage collection
  // run to prevent unnecessary memory growth.
  setTimeout(spf.cache.collect, 1000);
};


/**
 * Removes data from the cache.
 */
spf.cache.remove = function(key) {
  if (spf.cache.storage_ && key in spf.cache.storage_) {
    delete spf.cache.storage_[key];
  }
};


/**
 * Removes all data from the cache.
 */
spf.cache.clear = function() {
  delete spf.cache.storage_;
};


/**
 * Removes expired data from the cache (aka garbage collection). Invalid data
 * and data with an age exceeding the data lifetime will be removed.
 */
spf.cache.collect = function() {
  if (!spf.cache.storage_) {
    return;
  }
  for (var key in spf.cache.storage_) {
    var unit = spf.cache.storage_[key];
    // If invalid data exists, remove.
    if (!unit || !unit.data) {
      delete spf.cache.storage_[key];
    } else {
      var age = spf.now() - unit.timestamp;
      // A lifetime of NaN is considered forever; don't remove.
      // If the age is greater than the lifetime, remove.
      if (!isNaN(unit.lifetime) && age >= unit.lifetime) {
        delete spf.cache.storage_[key];
      }
    }
  }
};


/**
 * @type {Object.<string, spf.cache.Unit>}
 * @private
 */
spf.cache.storage_;


/**
 * @param {*} data The data.
 * @param {number} lifetime Lifetime for the data object.
 * @constructor
 */
spf.cache.Unit = function(data, lifetime) {
  this.data = data;
  this.lifetime = lifetime;
  this.timestamp = spf.now();
};
