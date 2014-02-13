/**
 * @fileoverview Functions for dynamically loading scripts without blocking.
 *
 * Provides asynchronous loading and dependency management, similar to
 * $script.js {@link https://github.com/ded/script.js/} but with enhancements.
 * Designed to be built as both a standlone bootstrap script loader in the
 * document head and also built as part of the main SPF code. When both the
 * bootstrap and main code is loaded on the same page, the main code extends
 * the bootstrap code for seamless script loading.
 *
 * Single script:
 * spf.net.scriptbeta.load(url, function() {
 *   // url is loaded
 * });
 *
 * Multiple scripts:
 * spf.net.scriptbeta.load([url1, url2], function() {
 *   // url1 and url2 are loaded, order not preserved
 * });
 * spf.net.scriptbeta.order([url1, url2], function() {
 *   // url1 and url2 are loaded, order preserved
 * });
 *
 * Named script(s) and readiness:
 * spf.net.scriptbeta.load(url, 'name');
 * spf.net.scriptbeta.ready('name', function() {
 *   // url is loaded
 * });
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.scriptbeta');

goog.require('spf.array');
goog.require('spf.debug');
goog.require('spf.net.resourcebeta');
goog.require('spf.pubsub');
goog.require('spf.string');


/**
 * Loads one or more scripts asynchronously and optionally defines a name to
 * use for dependency management and unloading.  See {@link #ready} to wait
 * for named scripts to be loaded and {@link #unload} to remove previously
 * loaded scripts.
 *
 * - Subsequent calls to load the same URL will not reload the script.  To
 *   reload a script, unload it first with {@link #unload}.
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be execute each time, even if the script is not reloaded.
 *
 * - A name can be specified to identify the same script at different URLs.
 *   (For example, "main-A.js" and "main-B.js" are both "main".)  If a name
 *   is specified, all other scripts with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same script at different URLs.
 *
 * @param {string|Array.<string>} urls One or more URLs of scripts to load.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the script(s)
 *     or callback function to execute when the script is loaded.
 * @param {Function=} opt_fn Callback function to execute when the script is
 *     loaded.
 * @param {boolean=} opt_order Whether to load the scripts in sequential order.
 */
spf.net.scriptbeta.load = function(urls, opt_nameOrFn, opt_fn, opt_order) {
  var type = spf.net.resourcebeta.Type.JS;

  // Convert to an array if needed.
  urls = /** @type {Array} */ (spf.array.isArray(urls) ? urls : [urls]);
  urls = spf.array.map(urls, spf.net.scriptbeta.canonicalize_);

  // Determine if a name was provided with 2 or 3 arguments.
  var withName = spf.string.isString(opt_nameOrFn);
  var name = /** @type {string} */ (withName ? opt_nameOrFn : '');
  var callback = /** @type {Function} */ (withName ? opt_fn : opt_nameOrFn);
  spf.debug.debug('script.load', urls, name);

  var loaded = spf.array.every(urls, spf.net.scriptbeta.loaded_);

  if (name) {
    // If loading new scripts for a name, handle unloading previous ones.
    if (!loaded && spf.net.resourcebeta.list(type, name)) {
      spf.net.scriptbeta.unload(name);
    }
    // Associate the scripts with the name.
    spf.net.resourcebeta.register(type, name, urls);
  }

  var pseudonym = name || spf.net.scriptbeta.label_(urls.sort().join(''));
  var topic = spf.net.scriptbeta.prefix_(pseudonym);
  spf.net.resourcebeta.register(type, pseudonym, urls);
  spf.debug.debug('  subscribing', topic);
  spf.pubsub.subscribe(topic, callback);
  // Start asynchronously loading all the scripts.
  if (opt_order) {
    var i = -1, l = urls.length;
    var next = function() {
      setTimeout(spf.net.scriptbeta.check, 0);
      i++;
      if (i < urls.length) {
        // Use a self-referencing callback for sequential loading.
        if (spf.net.scriptbeta.exists_(urls[i])) {
          next();
        } else {
          var el = spf.net.scriptbeta.get(urls[i], next);
          if (name) {
            el.title = name;
          }
        }
      }
    };
    next();
  } else {
    spf.array.each(urls, function(url) {
      // If a status exists, the script is already loading or loaded.
      if (spf.net.scriptbeta.exists_(url)) {
        setTimeout(spf.net.scriptbeta.check, 0);
      } else {
        var el = spf.net.scriptbeta.get(url, spf.net.scriptbeta.check);
        if (name) {
          el.title = name;
        }
      }
    });
  }
};


/**
 * Loads multiple scripts asynchronously in sequential order and optionally
 * defines a name to use for dependency management.  See {@link #load} for
 * non-sequential loading and {@link #ready} to wait for named scripts
 * to be loaded.
 *
 * @param {Array.<string>} urls An array for scripts to load sequentially.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the script
 *     independently or a callback to execute when the script is loaded.
 * @param {Function=} opt_fn Callback function to execute when the
 *     script is loaded.
 */
spf.net.scriptbeta.order = function(urls, opt_nameOrFn, opt_fn) {
  spf.debug.debug('script.order', urls);
  spf.net.scriptbeta.load(urls, opt_nameOrFn, opt_fn, true);
};


/**
 * Unloads scripts identified by dependency name.  See {@link #load}.
 *
 * NOTE: Unloading a script will prevent execution of ALL pending callbacks
 * but is NOT guaranteed to stop the browser loading a pending URL.
 *
 * @param {string} name The dependency name.
 */
spf.net.scriptbeta.unload = function(name) {
  spf.debug.warn('script.unload', name);
  var type = spf.net.resourcebeta.Type.JS;
  // Convert to an array if needed.
  var urls = spf.net.resourcebeta.list(type, name) || [];
  if (urls.length) {
    spf.debug.warn('  >', urls);
    spf.dispatch('jsunload', name);
    spf.array.each(urls, function(url) {
      spf.net.resourcebeta.destroy(type, url);
    });
  }
  spf.net.resourcebeta.unregister(type, name);
};


/**
 * Discovers existing scripts in the document and registers them as loaded.
 */
spf.net.scriptbeta.discover = function() {
  spf.debug.debug('script.discover');
  var type = spf.net.resourcebeta.Type.JS;
  var els = spf.net.resourcebeta.discover(type);
  spf.array.each(els, function(el) {
    if (el.title) {
      spf.net.resourcebeta.register(type, el.title, [el.src]);
    }
    spf.debug.debug('  found', el.src, el.title);
  });
};


/**
 * Unconditionally loads a script by dynamically creating an element and
 * appending it to the document without regard for dependencies or whether it
 * has been loaded before.  A script directly loaded by this method cannot
 * be unloaded by name.  Compare to {@link #load}.
 *
 * @param {string} url The URL of the script to load.
 * @param {Function=} opt_fn Function to execute when loaded.
 * @return {Element} The newly created element.
 */
spf.net.scriptbeta.get = function(url, opt_fn) {
  var type = spf.net.resourcebeta.Type.JS;
  return spf.net.resourcebeta.create(type, url, opt_fn);
};


/**
 * Waits for one or more scripts identified by name to be loaded and executes
 * the callback function.  See {@link #load} or {@link #done} to define names.
 *
 * @param {string|Array.<string>} names One or more dependencies names.
 * @param {Function=} opt_fn Callback function to execute when the
 *     scripts have loaded.
 * @param {Function=} opt_require Callback function to execute if dependencies
 *     are specified that have not yet been defined/loaded.
 */
spf.net.scriptbeta.ready = function(names, opt_fn, opt_require) {
  // Convert to an array if needed.
  names = /** @type {Array} */ (spf.array.isArray(names) ? names : [names]);
  spf.debug.debug('script.ready', names);
  var type = spf.net.resourcebeta.Type.JS;

  // Find missing dependencies.
  var unknown = [];
  spf.array.each(names, function(name) {
    if (!spf.net.resourcebeta.list(type, name)) {
      unknown.push(name);
    }
  });

  // Check if all dependencies are loaded.
  var known = !unknown.length;
  if (opt_fn) {
    var ready = spf.array.every(names, spf.net.scriptbeta.allLoadedForName_);
    if (known && ready) {
      // If ready, execute the callback.
      opt_fn();
    } else {
      // Otherwise, wait for them to be loaded.
      var topic = spf.net.scriptbeta.prefix_(names.sort().join('|'));
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
 * Notifies any waiting callbacks that {@code name} has completed loading.
 * Use with {@link #ready} for arbitrary readiness not directly tied to scripts.
 *
 * @param {string} name The ready name.
 */
spf.net.scriptbeta.done = function(name) {
  var type = spf.net.resourcebeta.Type.JS;
  spf.net.resourcebeta.register(type, name, []);
  spf.net.scriptbeta.check();
};


/**
 * "Ignores" a script load by canceling execution of a pending callback.
 *
 * Stops waiting for one or more scripts identified by name to be loaded and
 * cancels the pending callback execution.  The callback must have been
 * registered by {@link #load}, {@link #order} or {@link #ready}.  If the
 * callback was registered by {@link #ready} and more than one name was
 * provided, the same names must be used here.
 *
 * @param {string|Array.<string>} names One or more dependencies names.
 * @param {Function} fn Callback function to cancel.
 */
spf.net.scriptbeta.ignore = function(names, fn) {
  // Convert to an array if needed.
  names = /** @type {Array} */ (spf.array.isArray(names) ? names : [names]);
  spf.debug.debug('script.ignore', names);
  var topic = spf.net.scriptbeta.prefix_(names.sort().join('|'));
  spf.debug.debug('  unsubscribing', topic);
  spf.pubsub.unsubscribe(topic, fn);
};


/**
 * Executes any pending callbacks possible by checking if all pending
 * dependecies have loaded.
 */
spf.net.scriptbeta.check = function() {
  spf.debug.debug('script.check');
  var prefix = spf.net.scriptbeta.prefix_('');
  for (var topic in spf.pubsub.subscriptions()) {
    if (topic.indexOf(prefix) == 0) {
      var names = topic.substring(prefix.length).split('|');
      var ready = spf.array.every(names, spf.net.scriptbeta.allLoadedForName_);
      spf.debug.debug(' ', topic, '->', names, '=', ready);
      if (ready) {
        spf.debug.debug('  publishing', topic);
        spf.pubsub.publish(topic);
        spf.pubsub.clear(topic);
      }
    }
  }
};


/**
 * Prefetchs one or more scripts; the scripts will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the script when
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of scripts to prefetch.
 */
spf.net.scriptbeta.prefetch = function(urls) {
  var type = spf.net.resourcebeta.Type.JS;
  // Convert to an array if needed.
  urls = /** @type {Array} */ (spf.array.isArray(urls) ? urls : [urls]);
  urls = spf.array.map(urls, spf.net.scriptbeta.canonicalize_);
  spf.array.each(urls, function(url) {
    spf.net.resourcebeta.prefetch(type, url);
  });
};


/**
 * Evaluates script text.  A callback can be specified to execute once
 * evaluation is done.
 *
 * @param {string} text The text of the script.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 * @return {undefined}
 */
spf.net.scriptbeta.eval = function(text, opt_callback) {
  text = spf.string.trim(text);
  if (text) {
    if (window.execScript) {
      // For IE, reach global scope using execScript to avoid a bug where
      // indirect eval is treated as direct eval.
      window.execScript(text);
    } else if (spf.string.startsWith(text, 'use strict', 1)) {
      // For strict mode, reach global scope using the slower script injection
      // method.
      var scriptEl = document.createElement('script');
      scriptEl.text = text;
      // Place the scripts in the head instead of the body to avoid errors when
      // called from the head in the first place.
      var targetEl = document.getElementsByTagName('head')[0] || document.body;
      targetEl.appendChild(scriptEl);
      targetEl.removeChild(scriptEl);
    } else {
      // Otherwise, use indirect eval to reach global scope.
      (0, eval)(text);
    }
  }
  if (opt_callback) {
    opt_callback();
  }
};


/**
 * Sets the base path to use when resolving relative URLs.
 *
 * @param {string} path The path.
 */
spf.net.scriptbeta.path = function(path) {
  var type = spf.net.resourcebeta.Type.JS;
  spf.net.resourcebeta.path(type, path);
};


/**
 * Convert a script URL to the "canonical" version by prepending the base path
 * and appending .js if needed.  See {@link #path}.  Ignores absolute URLs
 * (i.e. those that start with http://, etc).
 *
 * @param {string} url The initial url.
 * @return {string} The adjusted url.
 * @private
 */
spf.net.scriptbeta.canonicalize_ = function(url) {
  var type = spf.net.resourcebeta.Type.JS;
  return spf.net.resourcebeta.canonicalize(type, url);
};


/**
 * Prefix a name to avoid conflicts.
 *
 * @param {?} name The name
 * @return {string} The prefixed name.
 * @private
 */
spf.net.scriptbeta.prefix_ = function(name) {
  var type = spf.net.resourcebeta.Type.JS;
  return spf.net.resourcebeta.prefix(type, name);
};


/**
 * Convert a URL to an internal "name" for use in identifying it.
 *
 * @param {string} url The script URL.
 * @return {string} The name.
 * @private
 */
spf.net.scriptbeta.label_ = function(url) {
  return spf.net.resourcebeta.label(url);
};


/**
 * Checks to see if all urls for a dependency have been loaded.
 * @param {string} name The dependency name.
 * @return {boolean}
 * @private
 */
spf.net.scriptbeta.allLoadedForName_ = function(name) {
  var type = spf.net.resourcebeta.Type.JS;
  var urls = spf.net.resourcebeta.list(type, name);
  return !!urls && spf.array.every(urls, spf.net.scriptbeta.loaded_);
};


/**
 * Checks to see if a script exists.
 * (If a URL is loading or loaded, then it exists.)
 *
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 * @private
 */
spf.net.scriptbeta.exists_ = function(url) {
  return spf.net.resourcebeta.exists(url);
};


/**
 * Checks to see if a script has been loaded.
 * (Falsey URL values (e.g. null or an empty string) are always "loaded".)
 *
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 * @private
 */
spf.net.scriptbeta.loaded_ = function(url) {
  return spf.net.resourcebeta.loaded(url);
};
