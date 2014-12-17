// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for dynamically loading scripts without blocking.
 *
 * Provides asynchronous loading and dependency management, loosely similar to
 * $script.js {@link https://github.com/ded/script.js/} but with enhancements.
 * Designed to be built as both a standlone bootstrap script loader in the
 * document head and also built as part of the main SPF code. When both the
 * bootstrap and main code is loaded on the same page, the main code extends
 * the bootstrap code for seamless script loading.
 *
 * Unconditionally load a script:
 *     spf.net.script.get(url, function() {
 *       // url is loaded
 *     });
 *
 * Conditionally load a script only if not already loaded:
 *     spf.net.script.load(url, 'name', function() {
 *       // url is loaded
 *     });
 * Or:
 *     spf.net.script.load(url, 'name');
 *     spf.net.script.ready('name', function() {
 *       // url is loaded
 *     });
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.script');

goog.require('spf.array');
goog.require('spf.debug');
goog.require('spf.net.resource');
goog.require('spf.net.resource.url');
goog.require('spf.pubsub');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tracing');


/**
 * Loads a script asynchronously and defines a name to use for dependency
 * management and unloading.  See {@link #ready} to wait for named scripts to
 * be loaded and {@link #unload} to remove previously loaded scripts.
 *
 * - Subsequent calls to load the same URL will not reload the script.  To
 *   reload a script, unload it first with {@link #unload}.  To unconditionally
 *   load a script, see {@link #get}.
 *
 * - A name must be specified to identify the same script at different URLs.
 *   (For example, "main-A.js" and "main-B.js" are both "main".)  When a name
 *   is specified, all other scripts with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same script at different URLs.
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be executed each time, even if the script is not reloaded.
 *
 * @param {string} url URL of the script to load.
 * @param {string} name Name to identify the script.
 * @param {Function=} opt_fn Optional callback function to execute when the
 *     script is loaded.
 */
spf.net.script.load = function(url, name, opt_fn) {
  var type = spf.net.resource.Type.JS;
  spf.net.resource.load(type, url, name, opt_fn);
};


/**
 * Unloads scripts identified by name.  See {@link #load}.
 *
 * NOTE: Unloading a script will prevent execution of ALL pending callbacks
 * but is NOT guaranteed to stop the browser loading a pending URL.
 *
 * @param {string} name The name.
 */
spf.net.script.unload = function(name) {
  var type = spf.net.resource.Type.JS;
  spf.net.resource.unload(type, name);
};


/**
 * Discovers existing scripts in the document and registers them as loaded.
 */
spf.net.script.discover = function() {
  var type = spf.net.resource.Type.JS;
  spf.net.resource.discover(type);
};


/**
 * Unconditionally loads a script by dynamically creating an element and
 * appending it to the document without regard for dependencies or whether it
 * has been loaded before.  A script directly loaded by this method cannot
 * be unloaded by name.  Compare to {@link #load}.
 *
 * @param {string} url URL of the script to load.
 * @param {Function=} opt_fn Function to execute when loaded.
 */
spf.net.script.get = function(url, opt_fn) {
  var type = spf.net.resource.Type.JS;
  spf.net.resource.create(type, url, opt_fn);
};


/**
 * Prefetchs one or more scripts; the scripts will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the script when
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of scripts to prefetch.
 */
spf.net.script.prefetch = function(urls) {
  var type = spf.net.resource.Type.JS;
  // Convert to an array if needed.
  urls = spf.array.toArray(urls);
  spf.array.each(urls, function(url) {
    spf.net.resource.prefetch(type, url);
  });
};


/**
 * Waits for one or more scripts identified by name to be loaded and executes
 * the callback function.  See {@link #load} or {@link #done} to define names.
 * If an empty name is provided, it will be considered loaded immediately.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function=} opt_fn Callback function to execute when the
 *     scripts have loaded.
 * @param {Function=} opt_require Callback function to execute if names
 *     are specified that have not yet been defined/loaded.
 */
spf.net.script.ready = function(names, opt_fn, opt_require) {
  var type = spf.net.resource.Type.JS;

  // Convert to an array if needed.
  names = spf.array.toArray(names);
  spf.debug.debug('script.ready', names);

  // Filter out empty names.
  names = spf.array.filter(names, function(name) {
    return !!name;
  });

  // Find unknown names.
  var unknown = [];
  spf.array.each(names, function(name) {
    if (spf.net.resource.url.get(type, name) == undefined) {
      unknown.push(name);
    }
  });

  // Check if all urls for the names are loaded.
  var known = !unknown.length;
  if (opt_fn) {
    var loaded = spf.bind(spf.net.resource.url.loaded, null, type);
    var ready = spf.array.every(names, loaded);
    if (known && ready) {
      // If ready, execute the callback.
      opt_fn();
    } else {
      // Otherwise, wait for them to be loaded.
      var topic = spf.net.resource.key(type, names.sort().join('|'));
      spf.debug.debug('  subscribing', topic);
      spf.pubsub.subscribe(topic, opt_fn);
    }
  }
  // If provided, call the require function to allow lazy-loading.
  if (opt_require && !known) {
    opt_require(unknown);
  }
};


/**
 * Notifies any waiting callbacks that `name` has completed loading.
 * Use with {@link #ready} for arbitrary readiness not directly tied to scripts.
 *
 * @param {string} name The ready name.
 */
spf.net.script.done = function(name) {
  var type = spf.net.resource.Type.JS;
  spf.net.resource.url.set(type, name, '');  // No associated URL.
  spf.net.resource.check(type);
};


/**
 * "Ignores" a script load by canceling execution of a pending callback.
 *
 * Stops waiting for one or more scripts identified by name to be loaded and
 * cancels the pending callback execution.  The callback must have been
 * registered by {@link #load} or {@link #ready}.  If the callback was
 * registered by {@link #ready} and more than one name was provided, the same
 * names must be used here.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function} fn Callback function to cancel.
 */
spf.net.script.ignore = function(names, fn) {
  var type = spf.net.resource.Type.JS;
  // Convert to an array if needed.
  names = spf.array.toArray(names);
  spf.debug.debug('script.ignore', names);
  var topic = spf.net.resource.key(type, names.sort().join('|'));
  spf.debug.debug('  unsubscribing', topic);
  spf.pubsub.unsubscribe(topic, fn);
};


/**
 * Recursively loads scripts identified by name, first loading
 * any dependendent scripts.  Use {@link #declare} to define dependencies.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function=} opt_fn Callback function to execute when the
 *     scripts have loaded.
 */
spf.net.script.require = function(names, opt_fn) {
  var type = spf.net.resource.Type.JS;
  spf.debug.debug('script.require', names);

  // When built for the bootloader, automatic unloading of scripts is not
  // supported.  If someone is attempting to load a new version of a script
  // before loading the main SPF code, then this should be an error.  Automatic
  // unloading of scripts is primarily intended for navigation between versions.
  if (!SPF_BOOTLOADER) {
    // Convert to an array if needed.
    names = spf.array.toArray(names);
    spf.array.each(names, function(name) {
      if (name) {
        var url = spf.net.script.url_[name] || name;
        url = spf.net.resource.canonicalize(type, url);
        var previous = spf.net.resource.url.get(type, name);
        if (previous && url != previous) {
          spf.net.script.unrequire(name);
        }
      }
    });
  }

  spf.net.script.ready(names, opt_fn, spf.net.script.require_);
};


/**
 * See {@link #require}.
 *
 * @param {Array.<string>} names The names.
 * @private
 */
spf.net.script.require_ = function(names) {
  // Iterate and check if there are declared dependencies.
  // If so, check if the deps are ready and if not recurse.
  // If not, load the scripts for that name.
  spf.array.each(names, function(name) {
    var deps = spf.net.script.deps_[name];
    var url = spf.net.script.url_[name] || name;
    var next = function() {
      spf.net.script.load(url, name);
    };
    if (deps) {
      spf.net.script.require(deps, next);
    } else {
      next();
    }
  });
};


/**
 * Recursively unloads scripts identified by name, first unloading
 * any dependendent scripts.  Use {@link #declare} to define dependencies.
 *
 * @param {string|Array.<string>} names One or more names.
 */
spf.net.script.unrequire = function(names) {
  spf.debug.debug('script.unrequire', names);
  // Convert to an array if needed.
  names = spf.array.toArray(names);
  spf.array.each(names, function(name) {
    var descendants = [];
    for (var dep in spf.net.script.deps_) {
      var list = spf.net.script.deps_[dep];
      list = spf.array.toArray(list);
      spf.array.each(list, function(l) {
        if (l == name) {
          descendants.push(dep);
        }
      });
    }
    spf.array.each(descendants, function(descend) {
      spf.net.script.unrequire(descend);
    });
    spf.net.script.unload(name);
  });
};


/**
 * Evaluates script text and defines a name to use for management.
 *
 * - Subsequent calls to evaluate the same text will not re-evaluate the script.
 *   To unconditionally evalute a script, see {@link #exec}.
 *
 * @param {string} text The text of the script.
 * @param {string} name Name to identify the script.
 * @return {undefined}
 */
spf.net.script.eval = function(text, name) {
  var type = spf.net.resource.Type.JS;
  var el = spf.net.resource.eval(type, text, name);
};


/**
 * Unconditionally evaluates script text.  See {@link #eval}.
 *
 * @param {string} text The text of the script.
 */
spf.net.script.exec = function(text) {
  var type = spf.net.resource.Type.JS;
  var el = spf.net.resource.exec(type, text);
};


/**
 * Sets the dependency map and optional URL map used when requiring scripts.
 * See {@link #require}.
 *
 * @param {Object.<(string|Array.<string>)>} deps The dependency map.
 * @param {Object.<string>=} opt_urls The optional URL map.
 */
spf.net.script.declare = function(deps, opt_urls) {
  if (deps) {
    for (var name in deps) {
      spf.net.script.deps_[name] = deps[name];
    }
    if (opt_urls) {
      for (var name in opt_urls) {
        spf.net.script.url_[name] = opt_urls[name];
      }
    }
  }
};


/**
 * Sets the path prefix or replacement map to use when resolving relative URLs.
 *
 * Note: The order in which replacements are made is not guaranteed.
 *
 * @param {string|Object.<string>} paths The paths.
 */
spf.net.script.path = function(paths) {
  var type = spf.net.resource.Type.JS;
  spf.net.resource.path(type, paths);
};


/**
 * Map of dependencies used for {@link #require}.
 * @type {!Object.<(string|Array.<string>)>}
 * @private
 */
spf.net.script.deps_ = {};
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.SCRIPT_DEPS, spf.net.script.deps_);
} else {
  if (!spf.state.has(spf.state.Key.SCRIPT_DEPS)) {
    spf.state.set(spf.state.Key.SCRIPT_DEPS, spf.net.script.deps_);
  }
  spf.net.script.deps_ = /** @type {!Object.<(string|Array.<string>)>} */ (
      spf.state.get(spf.state.Key.SCRIPT_DEPS));
}


/**
 * Map of dependency names to URLs for {@link #require}, used for custom
 * resolution before URL canonicalization.
 * @type {!Object.<string>}
 * @private
 */
spf.net.script.url_ = {};
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.SCRIPT_URL, spf.net.script.url_);
} else {
  if (!spf.state.has(spf.state.Key.SCRIPT_URL)) {
    spf.state.set(spf.state.Key.SCRIPT_URL, spf.net.script.url_);
  }
  spf.net.script.url_ = /** @type {!Object.<string>} */ (
      spf.state.get(spf.state.Key.SCRIPT_URL));
}


if (spf.tracing.ENABLED) {
  (function() {
    spf.net.script.load = spf.tracing.instrument(
        spf.net.script.load, 'spf.net.script.load');
    spf.net.script.unload = spf.tracing.instrument(
        spf.net.script.unload, 'spf.net.script.unload');
    spf.net.script.discover = spf.tracing.instrument(
        spf.net.script.discover, 'spf.net.script.discover');
    spf.net.script.get = spf.tracing.instrument(
        spf.net.script.get, 'spf.net.script.get');
    spf.net.script.prefetch = spf.tracing.instrument(
        spf.net.script.prefetch, 'spf.net.script.prefetch');
    spf.net.script.ready = spf.tracing.instrument(
        spf.net.script.ready, 'spf.net.script.ready');
    spf.net.script.done = spf.tracing.instrument(
        spf.net.script.done, 'spf.net.script.done');
    spf.net.script.ignore = spf.tracing.instrument(
        spf.net.script.ignore, 'spf.net.script.ignore');
    spf.net.script.require = spf.tracing.instrument(
        spf.net.script.require, 'spf.net.script.require');
    spf.net.script.require_ = spf.tracing.instrument(
        spf.net.script.require_, 'spf.net.script.require_');
    spf.net.script.unrequire = spf.tracing.instrument(
        spf.net.script.unrequire, 'spf.net.script.unrequire');
    spf.net.script.eval = spf.tracing.instrument(
        spf.net.script.eval, 'spf.net.script.eval');
    spf.net.script.declare = spf.tracing.instrument(
        spf.net.script.declare, 'spf.net.script.declare');
    spf.net.script.path = spf.tracing.instrument(
        spf.net.script.path, 'spf.net.script.path');
  })();
}
