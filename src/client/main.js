// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview The primary SPF entry point.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.main');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.history');
goog.require('spf.nav');
goog.require('spf.net.script');
goog.require('spf.net.style');
goog.require('spf.pubsub');


/**
 * Initializes SPF.
 *
 * @param {Object=} opt_config Optional global configuration object.
 * @return {boolean} Whether SPF was successfully initialized.  If the HTML5
 *     history modification API is not supported, returns false.
 */
spf.main.init = function(opt_config) {
  var enable = spf.main.canInit_();
  spf.debug.info('main.init ', 'enable=', enable);
  spf.config.init(opt_config);
  if (enable) {
    spf.nav.init();
  }
  return enable;
};


/**
 * Checks to see if SPF can be initialized.
 *
 * @return {boolean}
 * @private
 */
spf.main.canInit_ = function() {
  return !!(typeof window.history.pushState == 'function' ||
      spf.history.getIframe().contentWindow.history.pushState);
};


/**
 * Disposes SPF.
 */
spf.main.dispose = function() {
  var enable = !!(typeof History != 'undefined' && History.prototype.pushState);
  if (enable) {
    spf.nav.dispose();
  }
  spf.config.clear();
};


/**
 * Discovers existing script and style elements in the document and registers
 * them as loaded, once during initial code execution and again when the
 * document is ready to catch any resources in the page after SPF is included.
 * @private
 */
spf.main.discover_ = function() {
  spf.net.script.discover();
  spf.net.style.discover();
  if (document.readyState == 'complete') {
    // Since IE 8+ is supported for common library functions such as script
    // and style loading, use both standard and legacy event handlers to
    // discover existing resources.
    if (document.removeEventListener) {
      document.removeEventListener(
          'DOMContentLoaded', spf.main.discover_, false);
    } else if (document.detachEvent) {
      document.detachEvent(
          'onreadystatechange', spf.main.discover_);
    }
  }
};
if (document.addEventListener) {
  document.addEventListener(
      'DOMContentLoaded', spf.main.discover_, false);
} else if (document.attachEvent) {
  document.attachEvent(
        'onreadystatechange', spf.main.discover_);
}
spf.main.discover_();


// Create the API by exporting aliased functions.
// Core API functions are available on the top-level namespace.
// Extra API functions are available on second-level namespaces.
/** @private {!Object} */
spf.main.api_ = {
  'init': spf.main.init,
  'dispose': spf.main.dispose,
  'navigate': spf.nav.navigate,
  'load': spf.nav.load,
  'prefetch': spf.nav.prefetch,
  'process': spf.nav.process
};
/** @private {!Object} */
spf.main.extra_ = {
  'cache': {
    // Cache API.
    // * Remove one entry.
    'remove': spf.cache.remove,
    // * Clear all entries.
    'clear': spf.cache.clear
  },
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
    'path': spf.net.script.path,
    // Extended script loading API.
    // * Unload scripts.
    'unload': spf.net.script.unload,
    // * Ignore ready.
    'ignore': spf.net.script.ignore,
    // * Unload in depedency order.
    'unrequire': spf.net.script.unrequire,
    // * Prefetch.
    'prefetch': spf.net.script.prefetch
  },
  'style': {
    // Style loading API.
    // * Load styles.
    'load': spf.net.style.load,
    'get': spf.net.style.get,
    // * Unload styles.
    'unload': spf.net.style.unload,
    // * Set paths.
    'path': spf.net.style.path,
    // * Prefetch.
    'prefetch': spf.net.style.prefetch
  }
};
// For a production/debug build, isolate access to the API.
// For a development build, mixin the API to the existing namespace.
var global = this;
global['spf'] = global['spf'] || {};
var api = global['spf'];
for (var fn1 in spf.main.api_) {
  api[fn1] = spf.main.api_[fn1];
}
// Use two-stage exporting to allow aliasing the intermediate namespaces
// created by the bootloader (e.g. s = spf.script; s.load(...)).
for (var ns in spf.main.extra_) {
  for (var fn2 in spf.main.extra_[ns]) {
    api[ns] = api[ns] || {};
    api[ns][fn2] = spf.main.extra_[ns][fn2];
  }
}

// Signal that the API is ready with custom event.  Only supported in IE 9+.
spf.dispatch(spf.EventName.READY);
