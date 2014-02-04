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
 * Named scripts(s) and readiness:
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
goog.require('spf.state');
goog.require('spf.string');


/**
 * Loads one or more scripts asynchronously and optionally defines a name to
 * use for dependency management.  See {@link #ready} to wait for named scripts
 * to be loaded.
 *
 * - Subsequent calls to load the same URL will not reload the script.  To
 *   reload a script, unload it first with {@link #unload}
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
 * @param {string|Array.<string>} urls One or more urls of scripts to load.
 * @param {(string|Function)=} opt_nameOrCallback Name to identify the script(s)
 *     independently or a callback to execute when the script is loaded.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 */
spf.net.scriptbeta.load = function(urls, opt_nameOrCallback, opt_callback) {
  // Convert to an array if needed.
  urls = /** @type {Array} */ (spf.array.isArray(urls) ? urls : [urls]);
  // Determine if a name was provided with 2 or 3 arguments.
  var withName = spf.string.isString(opt_nameOrCallback);
  var name = /** @type {string} */ (
      withName ? opt_nameOrCallback : '^' + urls.join(''));
  var callback = /** @type {Function} */ (
      withName ? opt_callback : opt_nameOrCallback);
  spf.debug.debug('script', urls, name);

  // TODO(nicksay): Implement "unloading" of scripts.
  //
  // If loading new scripts for a name, handle unloading previous ones.
  // if (name in spf.net.scriptbeta.names_) {
  // }

  // Associate the scripts with the name.
  urls = spf.array.map(urls, spf.net.scriptbeta.canonicalize_);
  spf.net.scriptbeta.names_[name] = urls;
  spf.debug.debug('  ', urls);

  // If all the scripts are already loaded, execute the callback;
  if (spf.net.scriptbeta.allLoaded_(name)) {
    spf.debug.debug('  all urls already loaded');
    if (callback) {
      callback();
    }
    setTimeout(spf.net.scriptbeta.check_, 0);
  } else {
    // Otherwise, wait for them to be loaded.
    spf.debug.debug('  subscribing', name);
    spf.pubsub.subscribe(name, callback);
    // Start asynchronously loading all the scripts.
    spf.array.each(urls, function(url) {
      if (!spf.net.scriptbeta.isLoaded_(url) &&
          !spf.net.scriptbeta.isLoading_(url)) {
        spf.net.scriptbeta.get(url, spf.net.scriptbeta.check_);
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
 * @param {(string|Function)=} opt_nameOrCallback Name to identify the script
 *     independently or a callback to execute when the script is loaded.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 */
spf.net.scriptbeta.order = function(urls, opt_nameOrCallback, opt_callback) {
  spf.debug.debug('script.order', urls);
  var completed = [];
  var next = function() {
    if (urls.length) {
      var url = urls.shift();
      completed.push(url);
      spf.debug.debug('  processing', completed, urls);
      // Use a self-referencing callback for sequential loading.
      spf.net.scriptbeta.load(url, next);
    } else {
      spf.debug.debug('  completed');
      // Call load with the completed urls to store them all by name.
      spf.net.scriptbeta.load(completed, opt_nameOrCallback, opt_callback);
    }
  };
  next();
};


/**
 * Unconditionally loads a script by dynamically creating an element and
 * appending it to the document without regard for dependencies or whether it
 * has been loaded before.  Compare to {@link #load}.
 *
 * @param {string} url The URL of the script to load.
 * @param {Function=} opt_callback Function to execute when loaded.
 * @return {Element} The newly created script element.
 */
spf.net.scriptbeta.get = function(url, opt_callback) {
  spf.debug.debug('script.get loading', url);
  spf.net.scriptbeta.urls_[url] = spf.net.scriptbeta.Status.LOADING;
  var type = spf.net.resourcebeta.Type.JS;
  return spf.net.resourcebeta.get(type, url, function() {
    spf.debug.debug('script.get loaded', url);
    spf.net.scriptbeta.urls_[url] = spf.net.scriptbeta.Status.LOADED;
    if (opt_callback) {
      opt_callback();
    }
  });
};


/**
 * Waits for one or more scripts identified by name to be loaded and executes
 * the callback function.  See {@link #load} or {@link #done} to define names.
 *
 * @param {string|Array.<string>} deps One or more dependencies names.
 * @param {Function=} opt_callback Callback function to execute when the
 *     scripts have loaded.
 * @param {Function=} opt_require Callback function to execute if dependencies
 *     are specified that have not yet been defined/loaded.
 */
spf.net.scriptbeta.ready = function(deps, opt_callback, opt_require) {
  // Convert to an array if needed.
  deps = /** @type {Array} */ (spf.array.isArray(deps) ? deps : [deps]);
  spf.debug.debug('script.ready', deps);

  // Find missing dependencies.
  var unknown = [];
  spf.array.each(deps, function(dep) {
    if (!spf.net.scriptbeta.names_[dep]) {
      unknown.push(dep);
    }
  });

  // Check if all dependencies are loaded.
  var known = !unknown.length;
  if (opt_callback) {
    var ready = known && spf.array.every(deps, spf.net.scriptbeta.allLoaded_);
    if (ready) {
      // If ready, execute the callback.
      opt_callback();
    } else {
      // Otherwise, wait for them to be loaded.
      var name = deps.join('|');
      spf.debug.debug('  subscribing', name);
      spf.pubsub.subscribe(name, opt_callback);
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
  spf.net.scriptbeta.load('', name);
};


/**
 * Executes any pending callbacks possible by checking if all pending
 * dependecies have loaded.
 * @private
 */
spf.net.scriptbeta.check_ = function() {
  spf.debug.debug('script.check');
  spf.debug.debug(spf.pubsub.subscriptions());
  for (var name in spf.pubsub.subscriptions()) {
    var deps = name.split('|');
    var ready = spf.array.every(deps, spf.net.scriptbeta.allLoaded_);
    spf.debug.debug(' ', name, '->', deps, '=', ready);
    if (ready) {
      spf.debug.debug('  publishing', name);
      spf.pubsub.publish(name);
      spf.pubsub.clear(name);
    }
  }
};


/**
 * Sets the base path to use when resolving relative URLs.
 *
 * @param {string} path The path.
 */
spf.net.scriptbeta.path = function(path) {
  spf.state.set('script-base', path);
};


/**
 * Convert a script URL to the "canonical" version by prepending the base path
 * and appending .js if needed.  See {@link #path}.  Ignores absolute URLs (i.e.
 * those that start with http://, etc).
 *
 * @param {string} url The initial url.
 * @return {string} The adjusted url.
 * @private
 */
spf.net.scriptbeta.canonicalize_ = function(url) {
  if (url && url.indexOf('//') < 0) {
    url = (spf.state.get('script-base') || '') + url;
    url = url.indexOf('.js') < 0 ? url + '.js' : url;
  }
  return url;
};


/**
 * Checks to see if all urls for a dependency have been loaded.
 * @param {string} dep The dependency name.
 * @return {boolean}
 * @private
 */
spf.net.scriptbeta.allLoaded_ = function(dep) {
  var urls = spf.net.scriptbeta.names_[dep];
  return !!urls && spf.array.every(urls, spf.net.scriptbeta.isLoaded_);
};


/**
 * Checks to see if a url has been loaded.
 * Note that falsey values (e.g. null or an empty string) are always loaded.
 *
 * string is considered always loaded.
 * @param {string} url The url.
 * @return {boolean} Whether the url is loaded.
 * @private
 */
spf.net.scriptbeta.isLoaded_ = function(url) {
  var status = spf.net.scriptbeta.urls_[url];
  return !url || status == spf.net.scriptbeta.Status.LOADED;
};


/**
 * Checks to see if a url is currently loading.
 * Note that falsey values (e.g. null or an empty string) are never loading.
 *
 * string is considered always loaded.
 * @param {string} url The url.
 * @return {boolean} Whether the url is loading.
 * @private
 */
spf.net.scriptbeta.isLoading_ = function(url) {
  var status = spf.net.scriptbeta.urls_[url];
  return status == spf.net.scriptbeta.Status.LOADING;
};


/**
 * Map of names to urls.
 * @type {!Object.<Array.<string>>}
 * @private
 */
spf.net.scriptbeta.names_ = {};
if (SPF_BETA || SPF_BOOTLOADER) {
  // When built for the script loader, only set the map.
  if (SPF_BOOTLOADER) {
    spf.state.set('script-names', spf.net.scriptbeta.names_);
  } else {
    if (!spf.state.has('script-names')) {
      spf.state.set('script-names', {});
    }
    spf.net.scriptbeta.names_ = /** @type {!Object.<Array.<string>>} */ (
        spf.state.get('script-names'));
  }
}


/**
 * Map of urls to status.
 * @type {!Object.<spf.net.scriptbeta.Status>}
 * @private
 */
spf.net.scriptbeta.urls_ = {};
if (SPF_BETA || SPF_BOOTLOADER) {
  // When built for the script loader, only set the map.
  if (SPF_BOOTLOADER) {
    spf.state.set('script-urls', spf.net.scriptbeta.urls_);
  } else {
    if (!spf.state.has('script-urls')) {
      spf.state.set('script-urls', {});
    }
    spf.net.scriptbeta.urls_ =
        /** @type {!Object.<spf.net.scriptbeta.Status>} */ (
        spf.state.get('script-urls'));
  }
}


/**
 * The status of a script.
 * @enum {number}
 */
spf.net.scriptbeta.Status = {
  LOADING: 1,
  LOADED: 2
};
