// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview The SPF bootloader (aka bootstrap script loader).
 *
 * A minimal subset of the SPF API to load scripts, designed to be inlined in
 * the document head and extended by the main SPF code.  Provides an interface
 * loosely similar to $script.js {@link https://github.com/ded/script.js/} but
 * with enhancements.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.bootloader');

goog.require('spf');
goog.require('spf.net.script');


// Create the bootloader API by exporting aliased functions.
/** @private {!Object} */
spf.bootloader.api_ = {
  'script': {
    // The bootloader API.
    // * Load scripts.
    'load': spf.net.script.load,
    'get': spf.net.script.get,
    // * Wait until ready.
    'ready': spf.net.script.ready,
    'done': spf.net.script.done,
    // * Load in depedency order.
    'require': spf.net.script.require,
    // * Set dependencies and paths.
    'declare': spf.net.script.declare,
    'path': spf.net.script.path
  }
};
// For a production/debug build, isolate access to the API.
// For a development build, mixin the API to the existing namespace.
var global = this;
global['spf'] = global['spf'] || {};
var api = global['spf'];
for (var fn in spf.bootloader.api_) {
  api[fn] = spf.bootloader.api_[fn];
}
