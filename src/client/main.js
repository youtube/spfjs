/**
 * @fileoverview The primary SPF entry point.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.main');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.nav');
goog.require('spf.net.scriptbeta');
goog.require('spf.net.scripts');
goog.require('spf.net.stylebeta');
goog.require('spf.net.styles');
goog.require('spf.pubsub');


/**
 * Initializes SPF.
 *
 * @param {Object=} opt_config Optional global configuration object.
 * @return {boolean} Whether SPF was successfully initialized.  If the HTML5
 *     history modification API is not supported, returns false.
 */
spf.main.init = function(opt_config) {
  var enable = !!(window.history.pushState);
  spf.debug.info('main.init ', 'enable=', enable);
  var config = opt_config || {};
  for (var key in spf.config.defaults) {
    var value = (key in config) ? config[key] : spf.config.defaults[key];
    spf.config.set(key, value);
  }
  if (enable) {
    spf.nav.init();
  }
  return enable;
};


/**
 * Disposes SPF.
 */
spf.main.dispose = function() {
  var enable = !!(window.history.pushState);
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
  if (SPF_BETA) {
    spf.net.scriptbeta.discover();
    spf.net.stylebeta.discover();
  } else {
    spf.net.scripts.mark();
    spf.net.styles.mark();
  }
  if (document.readyState == 'complete') {
    // Since IE 8+ is supported for common library functions such as script
    // and style loading, use both standard and legacy event handlers to mark
    // existing resources.
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
/** @private {Object} */
spf.main.api_ = {
  'init': spf.main.init,
  'dispose': spf.main.dispose,
  'navigate': spf.nav.navigate,
  'load': spf.nav.load,
  'process': spf.nav.response.process,  // TODO: Remove after deprecation.
  'prefetch': spf.nav.prefetch
};
// For beta builds, add an identifying flag.
if (SPF_BETA) {
  spf.main.api_['beta'] = true;
}
/** @private {Object} */
spf.main.extra_ = {};
if (SPF_BETA) {
  spf.main.extra_ = {
    'script': {
      // The bootloader API.
      // * Load scripts.
      'load': spf.net.scriptbeta.load,
      'get': spf.net.scriptbeta.get,
      // * Wait until ready.
      'ready': spf.net.scriptbeta.ready,
      'done': spf.net.scriptbeta.done,
      // * Load in depedency order.
      'require': spf.net.scriptbeta.require,
      // * Set dependencies and paths.
      'declare': spf.net.scriptbeta.declare,
      'path': spf.net.scriptbeta.path,
      // Extended script loading API.
      // * Unload scripts.
      'unload': spf.net.scriptbeta.unload,
      // * Ignore ready.
      'ignore': spf.net.scriptbeta.ignore,
      // * Unload in depedency order.
      'unrequire': spf.net.scriptbeta.unrequire,
      // * Prefetch.
      'prefetch': spf.net.scriptbeta.prefetch
    },
    'style': {
      // Style loading API.
      // * Load styles.
      'load': spf.net.stylebeta.load,
      'get': spf.net.stylebeta.get,
      // * Unload styles.
      'unload': spf.net.stylebeta.unload,
      // * Set paths.
      'path': spf.net.stylebeta.path,
      // * Prefetch.
      'prefetch': spf.net.stylebeta.prefetch
    }
  };
} else {
  spf.main.extra_ = {
    'scripts': {
      'load': spf.net.scripts.load,
      'unload': spf.net.scripts.unload,
      'ignore': spf.net.scripts.ignore,
      'prefetch': spf.net.scripts.prefetch
    },
    'styles': {
      'load': spf.net.styles.load,
      'unload': spf.net.styles.unload,
      'ignore': spf.net.styles.ignore,
      'prefetch': spf.net.styles.prefetch
    }
  };
}
if (!SPF_COMPILED) {
  // When not compiled, mixin the API to the existing namespace for development.
  // Use eval to work around the "incomplete alias" warning.
  for (var fn1 in spf.main.api_) {
    eval('spf[fn1] = spf.main.api_[fn1]');
  }
  for (var ns in spf.main.extra_) {
    for (var fn2 in spf.main.extra_[ns]) {
      eval('spf[ns] = spf[ns] || {};');
      eval('spf[ns][fn2] = spf.main.extra_[ns][fn2]');
    }
  }
} else {
  // When compiled for a production/debug build, isolate access to the API.
  (function() {
    window['spf'] = window['spf'] || {};
    for (var fn1 in spf.main.api_) {
      window['spf'][fn1] = spf.main.api_[fn1];
    }
    // Use two-stage exporting to allow aliasing intermediate namespaces
    // created by the bootloader (e.g. s = spf.script; s.load(...)).
    for (var ns in spf.main.extra_) {
      for (var fn2 in spf.main.extra_[ns]) {
        window['spf'][ns] = window['spf'][ns] || {};
        window['spf'][ns][fn2] = spf.main.extra_[ns][fn2];
      }
    }
  })();
}

// Signal that the API is ready with custom event.  Only supported in IE 9+.
spf.dispatch('ready');
