/**
 * @fileoverview Stubs for functions used in SPF for dependency management.
 *
 * This file is intended to be used for testing and development.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


var goog = {};


/**
 * @param {string} ns Namespace required in the form "base.package.part".
 */
goog.require = function(ns) {};


/**
 * @param {string} ns Namespace provided in the form "base.package.part".
 */
goog.provide = function(ns) {
  var parts = ns.split('.');
  var cur = window;
  for (var name; parts.length && (name = parts.shift());) {
    if (cur[name]) {
      cur = cur[name];
    } else {
      cur = cur[name] = {};
    }
  }
};
