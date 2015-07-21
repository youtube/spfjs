// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for handling the SPF state.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.state');


/**
 * Checks whether a current state value exists.
 *
 * @param {spf.state.Key} key The state key.
 * @return {boolean} Whether the state value exists.
 */
spf.state.has = function(key) {
  return key in spf.state.values_;
};


/**
 * Gets a current state value.
 *
 * @param {spf.state.Key} key The state key.
 * @return {*} The state value.
 */
spf.state.get = function(key) {
  return spf.state.values_[key];
};


/**
 * Sets a current state value.
 *
 * @param {spf.state.Key} key The state key.
 * @param {T} value The state value.
 * @return {T} The state value.
 * @template T
 */
spf.state.set = function(key, value) {
  spf.state.values_[key] = value;
  return value;
};


/**
 * @enum {string}
 */
spf.state.Key = {
  ASYNC_DEFERS: 'async-defers',
  ASYNC_LISTENER: 'async-listener',
  CACHE_COUNTER: 'cache-counter',
  CACHE_MAX: 'cache-max',
  CACHE_STORAGE: 'cache-storage',
  CONFIG_VALUES: 'config',
  HISTORY_CALLBACK: 'history-callback',
  HISTORY_ERROR_CALLBACK: 'history-error-callback',
  HISTORY_IGNORE_POP: 'history-ignore-pop',
  HISTORY_INIT: 'history-init',
  HISTORY_LISTENER: 'history-listener',
  HISTORY_TIMESTAMP: 'history-timestamp',
  HISTORY_URL: 'history-url',
  NAV_COUNTER: 'nav-counter',
  NAV_INIT: 'nav-init',
  NAV_INIT_TIME: 'nav-init-time',
  NAV_CLICK_LISTENER: 'nav-listener',
  NAV_MOUSEDOWN_LISTENER: 'nav-mousedown-listener',
  NAV_SCROLL_LISTENER: 'nav-scroll-listener',
  NAV_SCROLL_TEMP_POSITION: 'nav-scroll-position',
  NAV_SCROLL_TEMP_URL: 'nav-scroll-url',
  NAV_PREFETCHES: 'nav-prefetches',
  NAV_PROMOTE: 'nav-promote',
  NAV_PROMOTE_TIME: 'nav-promote-time',
  NAV_REQUEST: 'nav-request',
  PUBSUB_SUBS: 'ps-s',
  RESOURCE_NAME: 'rsrc-n',
  RESOURCE_PATHS_PREFIX: 'rsrc-p-',
  RESOURCE_STATUS: 'rsrc-s',
  RESOURCE_URL: 'rsrc-u',
  SCRIPT_DEPS: 'js-d',
  SCRIPT_URL: 'js-u',
  TASKS_UID: 'uid'
};


/**
 * Current state values.  Globally exported to maintain continuity
 * across revisions.
 * @private {Object}
 */
spf.state.values_ = window['_spf_state'] || {};
window['_spf_state'] = spf.state.values_;
