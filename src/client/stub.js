// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Stubs for functions used in SPF for dependency management.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


/** @define {boolean} Compiler flag to remove development code. */
var COMPILED = false;


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


/**
 * Reference to the global context.  In most cases this will be 'window'.
 */
goog.global = this;


/**
 * Empty function that does nothing.
 *
 * Used to allow compiler to optimize away functions.
 */
goog.nullFunction = function() {};


/**
 * Identity function that returns its first argument.
 *
 * @param {T=} opt_returnValue The single value that will be returned.
 * @param {...*} var_args Optional trailing arguments. These are ignored.
 * @return {T} The first argument.
 * @template T
 */
 goog.identityFunction = function(opt_returnValue, var_args) {
   return opt_returnValue;
 };
