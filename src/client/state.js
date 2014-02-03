/**
 * @fileoverview Functions for handling the SPF state.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.state');


/**
 * Checks whether a current state value exists.
 *
 * @param {string} name The state name.
 * @return {boolean} Whether the state value exists.
 */
spf.state.has = function(name) {
  return name in spf.state.values_;
};


/**
 * Gets a current state value.
 *
 * @param {string} name The state name.
 * @return {*} The state value.
 */
spf.state.get = function(name) {
  return spf.state.values_[name];
};


/**
 * Sets a current state value.
 *
 * @param {string} name The state name.
 * @param {*} value The state value.
 * @return {*} The state value.
 */
spf.state.set = function(name, value) {
  spf.state.values_[name] = value;
  return value;
};


/**
 * Current state values.  Globally exported to maintain continuity
 * across revisions.
 * @private {Object}
 */
spf.state.values_ = window['_spf_state'] || {};
window['_spf_state'] = spf.state.values_;
