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
  var age = spf.now() - unit.timestamp;
  // A lifetime of NaN is considered forever; always return the data.
  // If the age is less than the lifetime, return the data.
  if (isNaN(unit.lifetime) || age < unit.lifetime) {
    return unit.data;
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
