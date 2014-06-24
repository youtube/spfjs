// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.style');

goog.require('spf.array');
goog.require('spf.debug');
goog.require('spf.net.resource');
goog.require('spf.net.resource.urls');
goog.require('spf.pubsub');
goog.require('spf.string');
goog.require('spf.tracing');


/**
 * Loads one or more styles asynchronously and optionally defines a name to
 * use for dependency management and unloading.  See {@link #unload} to
 * remove previously loaded styles.
 *
 * - Subsequent calls to load the same URL will not reload the style.  To
 *   reload a style, unload it first with {@link #unload}.
 *
 * - A callback can be specified to execute once the style has loaded.  The
 *   callback will be executed each time, even if the style is not reloaded.
 *   NOTE: Unlike scripts, this callback is best effort and is supported
 *   in the following browser versions: IE 6, Chrome 19, Firefox 9, Safari 6.
 *
 * - A name can be specified to identify the same style at different URLs.
 *   (For example, "main-A.css" and "main-B.css" are both "main".)  If a name
 *   is specified, all other styles with the same name will be unloaded.
 *   This allows switching between versions of the same style at different URLs.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to load.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the style(s)
 *     or callback function to execute when the style is loaded.
 * @param {Function=} opt_fn Callback function to execute when the style is
 *     loaded.
 */
spf.net.style.load = function(urls, opt_nameOrFn, opt_fn) {
  var type = spf.net.resource.Type.CSS;

  // Convert to an array if needed.
  urls = spf.array.toArray(urls);

  // Determine if a name was provided with 2 or 3 arguments.
  var withName = spf.string.isString(opt_nameOrFn);
  var name = /** @type {string} */ (withName ? opt_nameOrFn : '');
  var callback = /** @type {Function} */ (withName ? opt_fn : opt_nameOrFn);
  spf.debug.debug('style.load', urls, name);

  // After the styles are loaded, execute the callback by default.
  var done = callback;

  // If a name is provided with different URLs, then also unload the previous
  // versions after the styles are loaded.
  //
  // NOTE: Unloading styles depends on onload support and is best effort.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  if (name) {
    var loaded = spf.array.every(urls, spf.net.style.loaded_);
    var previous = spf.net.resource.urls.get(type, name);
    // If loading new styles for a name, handle unloading previous ones.
    if (!loaded && previous) {
      spf.dispatch('cssbeforeunload', {'name': name, 'urls': previous});
      spf.net.resource.urls.clear(type, name);
      done = function() {
        spf.net.style.unload_(name, previous);
        callback && callback();
      };
    }
  }

  var pseudonym = name || '^' + urls.sort().join('^');
  // Associate the styles with the name (or pseudonym) to allow unloading.
  spf.net.resource.urls.set(type, pseudonym, urls);
  // Subscribe the callback to execute when all urls are loaded.
  var topic = spf.net.style.prefix_(pseudonym);
  spf.debug.debug('  subscribing', topic, done);
  spf.pubsub.subscribe(topic, done);
  // Start asynchronously loading all the styles.
  spf.array.each(urls, function(url) {
    // If a status exists, the style is already loading or loaded.
    if (spf.net.style.exists_(url)) {
      spf.net.style.check();
    } else {
      var el = spf.net.style.get(url, spf.net.style.check);
      if (name) {
        el.setAttribute('name', name);
      }
    }
  });
};


/**
 * Unloads styles identified by dependency name.  See {@link #load}.
 *
 * @param {string} name The dependency name.
 */
spf.net.style.unload = function(name) {
  spf.debug.warn('style.unload', name);
  var type = spf.net.resource.Type.CSS;
  // Convert to an array if needed.
  var urls = spf.net.resource.urls.get(type, name) || [];
  spf.net.resource.urls.clear(type, name);
  spf.net.style.unload_(name, urls);
};


/**
 * See {@link unload}.
 *
 * @param {string} name The name.
 * @param {Array.<string>} urls The URLs.
 * @private
 */
spf.net.style.unload_ = function(name, urls) {
  var type = spf.net.resource.Type.CSS;
  if (urls.length) {
    spf.debug.debug('  > style.unload', urls);
    spf.dispatch('cssunload', {'name': name, 'urls': urls});
    spf.array.each(urls, function(url) {
      spf.net.resource.destroy(type, url);
    });
  }
};

/**
 * Discovers existing styles in the document and registers them as loaded.
 */
spf.net.style.discover = function() {
  spf.debug.debug('style.discover');
  var type = spf.net.resource.Type.CSS;
  var els = spf.net.resource.discover(type);
  spf.array.each(els, function(el) {
    var name = el.getAttribute('name');
    if (name) {
      spf.net.resource.urls.set(type, name, [el.href]);
    }
    spf.debug.debug('  found', el.href, name);
  });
};


/**
 * Unconditionally loads a style by dynamically creating an element and
 * appending it to the document without regard for whether it has been loaded
 * before. A style directly loaded by this method cannot be unloaded by name.
 * Compare to {@link #load}.
 *
 * @param {string} url The URL of the style to load.
 * @param {Function=} opt_fn Function to execute when loaded.
 * @return {Element} The newly created element.
 */
spf.net.style.get = function(url, opt_fn) {
  var type = spf.net.resource.Type.CSS;
  // NOTE: Callback execution depends on onload support and is best effort.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  return spf.net.resource.create(type, url, opt_fn);
};


/**
 * Executes any pending callbacks possible by checking if all pending
 * urls for a name have loaded.
 */
spf.net.style.check = function() {
  spf.debug.debug('style.check');
  var prefix = spf.net.style.prefix_('');
  for (var topic in spf.pubsub.subscriptions) {
    if (topic.indexOf(prefix) == 0) {
      var names = topic.substring(prefix.length).split('|');
      var ready = spf.array.every(names, spf.net.style.allLoaded_);
      spf.debug.debug(' ', topic, '->', names, '=', ready);
      if (ready) {
        spf.debug.debug('  publishing', topic);
        // Because check evaluates the pubsub.subscriptions array to determine
        // if urls for names are loaded, there is a potential subscribe/publish
        // infinite loop:
        //     require_ -> load (subscribe) -> check (publish) ->
        //     load (subscribe) -> <loop forever> ...
        // To avoid this, use flush instead of publish + clear to ensure that
        // previously subscribed functions are removed before execution:
        //     require_ -> load (subscribe) -> check (flush) -> <no loop>
        spf.pubsub.flush(topic);
      }
    }
  }
};


/**
 * Prefetchs one or more styles; the styles will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the style when
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to prefetch.
 */
spf.net.style.prefetch = function(urls) {
  var type = spf.net.resource.Type.CSS;
  // Convert to an array if needed.
  urls = spf.array.toArray(urls);
  spf.array.each(urls, function(url) {
    spf.net.resource.prefetch(type, url);
  });
};


/**
 * Evaluates a set of styles by dynamically creating an element and appending it
 * to the document.  A callback can be specified to execute once evaluation
 * is done.
 *
 * @param {string} text The text of the style.
 * @return {undefined}
 */
spf.net.style.eval = function(text) {
  text = spf.string.trim(text);
  if (text) {
    var styleEl = document.createElement('style');
    var targetEl = document.getElementsByTagName('head')[0] || document.body;
    // IE requires the Style element to be in the document before accessing
    // the StyleSheet object.
    targetEl.appendChild(styleEl);
    if ('styleSheet' in styleEl) {
      styleEl.styleSheet.cssText = text;
    } else {
      styleEl.appendChild(document.createTextNode(text));
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
spf.net.style.path = function(paths) {
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.path(type, paths);
};


/**
 * Prefix a name to avoid conflicts.
 *
 * @param {?} name The name
 * @return {string} The prefixed name.
 * @private
 */
spf.net.style.prefix_ = function(name) {
  var type = spf.net.resource.Type.CSS;
  return spf.net.resource.prefix(type, name);
};


/**
 * Checks to see if a style exists.
 * (If a URL is loading or loaded, then it exists.)
 *
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 * @private
 */
spf.net.style.exists_ = function(url) {
  var type = spf.net.resource.Type.CSS;
  return spf.net.resource.exists(type, url);
};


/**
 * Checks to see if a style has been loaded.
 * (Falsey URL values (e.g. null or an empty string) are always "loaded".)
 *
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 * @private
 */
spf.net.style.loaded_ = function(url) {
  var type = spf.net.resource.Type.CSS;
  return spf.net.resource.loaded(type, url);
};


/**
 * Checks to see if all urls for a dependency have been loaded.
 * (Falsey dependency names (e.g. null or an empty string) are always "loaded".)
 *
 * @param {string} name The dependency name.
 * @return {boolean}
 * @private
 */
spf.net.style.allLoaded_ = function(name) {
  var type = spf.net.resource.Type.CSS;
  var urls = spf.net.resource.urls.get(type, name);
  return !name || (!!urls && spf.array.every(urls, spf.net.style.loaded_));
};


if (spf.tracing.ENABLED) {
  (function() {
    spf.net.style.load = spf.tracing.instrument(
        spf.net.style.load, 'spf.net.style.load');
    spf.net.style.unload = spf.tracing.instrument(
        spf.net.style.unload, 'spf.net.style.unload');
    spf.net.style.unload_ = spf.tracing.instrument(
        spf.net.style.unload_, 'spf.net.style.unload_');
    spf.net.style.discover = spf.tracing.instrument(
        spf.net.style.discover, 'spf.net.style.discover');
    spf.net.style.get = spf.tracing.instrument(
        spf.net.style.get, 'spf.net.style.get');
    spf.net.style.check = spf.tracing.instrument(
        spf.net.style.check, 'spf.net.style.check');
    spf.net.style.prefetch = spf.tracing.instrument(
        spf.net.style.prefetch, 'spf.net.style.prefetch');
    spf.net.style.eval = spf.tracing.instrument(
        spf.net.style.eval, 'spf.net.style.eval');
    spf.net.style.path = spf.tracing.instrument(
        spf.net.style.path, 'spf.net.style.path');
    spf.net.style.prefix_ = spf.tracing.instrument(
        spf.net.style.prefix_, 'spf.net.style.prefix_');
    spf.net.style.exists_ = spf.tracing.instrument(
        spf.net.style.exists_, 'spf.net.style.exists_');
    spf.net.style.loaded_ = spf.tracing.instrument(
        spf.net.style.loaded_, 'spf.net.style.loaded_');
    spf.net.style.allLoaded_ = spf.tracing.instrument(
        spf.net.style.allLoaded_, 'spf.net.style.allLoaded_');
  })();
}
