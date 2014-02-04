/**
 * @fileoverview The SPF bootloader (aka bootstrap script loader).
 *
 * A minimal subset of the SPF API to load scripts, designed to be inlined in
 * the document head and extended by the main SPF code.  Provides an interface
 * similar to $script.js (see {@link https://github.com/ded/script.js/}).
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.bootloader');

goog.require('spf');
goog.require('spf.net.scriptbeta');


// Create the script loader API by exporting aliased functions.
/** @private {Object} */
spf.bootloader.api_ = {
  'script': {
    'load': spf.net.scriptbeta.load,
    'order': spf.net.scriptbeta.order,
    'get': spf.net.scriptbeta.get,
    'ready': spf.net.scriptbeta.ready,
    'done': spf.net.scriptbeta.done,
    'path': spf.net.scriptbeta.path
  }
};
if (!SPF_COMPILED) {
  // When not compiled, mixin the API to the existing namespace for development.
  for (var key in spf.bootloader.api_) {
    // Work around the "incomplete alias" warning.
    eval('spf[key] = spf.bootloader.api_[key]');
  }
} else {
  // When compiled for a production/debug build, isolate access to the API.
  window['spf'] = spf.bootloader.api_;
}
