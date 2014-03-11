/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.stylebeta');

goog.require('spf.array');
goog.require('spf.debug');
goog.require('spf.net.resourcebeta');
goog.require('spf.net.resourcebeta.urls');
goog.require('spf.pubsub');
goog.require('spf.string');


/**
 * Loads one or more styles asynchronously and optionally defines a name to
 * use for dependency management and unloading.  See {@link #unload} to
 * remove previously loaded styles.
 *
 * - Subsequent calls to load the same URL will not reload the style.  To
 *   reload a style, unload it first with {@link #unload}.
 *
 * - A name can be specified to identify the same style at different URLs.
 *   (For example, "main-A.css" and "main-B.css" are both "main".)  If a name
 *   is specified, all other styles with the same name will be unloaded.
 *   This allows switching between versions of the same style at different URLs.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to load.
 * @param {string=} opt_name Name to identify the style(s).
 */
spf.net.stylebeta.load = function(urls, opt_name) {
  var type = spf.net.resourcebeta.Type.CSS;

  // Convert to an array if needed.
  urls = spf.array.toArray(urls);

  var name = opt_name || '';
  spf.debug.debug('style.load', urls, name);

  // After the styles are loaded, do nothing by default.
  var done = null;

  // If a name is provided with different URLs, then also unload the previous
  // versions after the styles are loaded.
  //
  // NOTE: Unloading styles depends on onload support and is best effort.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  if (name) {
    var loaded = spf.array.every(urls, spf.net.stylebeta.loaded_);
    var previous = spf.net.resourcebeta.urls.get(type, name);
    // If loading new styles for a name, handle unloading previous ones.
    if (!loaded && previous) {
      spf.dispatch('cssbeforeunload', {'name': name, 'urls': previous});
      spf.net.resourcebeta.urls.clear(type, name);
      done = function() {
        spf.net.stylebeta.unload_(name, previous);
      };
    }
  }

  var pseudonym = name || '^' + urls.join('^');
  // Associate the styles with the name (or pseudonym) to allow unloading.
  spf.net.resourcebeta.urls.set(type, pseudonym, urls);
  // Subscribe the callback to execute when all urls are loaded.
  var topic = spf.net.stylebeta.prefix_(pseudonym);
  spf.debug.debug('  subscribing', topic, done);
  spf.pubsub.subscribe(topic, done);
  // Start asynchronously loading all the styles.
  spf.array.each(urls, function(url) {
    // If a status exists, the style is already loading or loaded.
    if (spf.net.stylebeta.exists_(url)) {
      setTimeout(spf.net.stylebeta.check, 0);
    } else {
      var el = spf.net.stylebeta.get(url, spf.net.stylebeta.check);
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
spf.net.stylebeta.unload = function(name) {
  spf.debug.warn('style.unload', name);
  var type = spf.net.resourcebeta.Type.CSS;
  // Convert to an array if needed.
  var urls = spf.net.resourcebeta.urls.get(type, name) || [];
  spf.net.resourcebeta.urls.clear(type, name);
  spf.net.stylebeta.unload_(name, urls);
};


/**
 * See {@link unload}.
 *
 * @param {string} name The name.
 * @param {Array.<string>} urls The URLs.
 * @private
 */
spf.net.stylebeta.unload_ = function(name, urls) {
  var type = spf.net.resourcebeta.Type.CSS;
  if (urls.length) {
    spf.debug.debug('  > style.unload', urls);
    spf.dispatch('cssunload', {'name': name, 'urls': urls});
    spf.array.each(urls, function(url) {
      spf.net.resourcebeta.destroy(type, url);
    });
  }
};

/**
 * Discovers existing styles in the document and registers them as loaded.
 */
spf.net.stylebeta.discover = function() {
  spf.debug.debug('style.discover');
  var type = spf.net.resourcebeta.Type.CSS;
  var els = spf.net.resourcebeta.discover(type);
  spf.array.each(els, function(el) {
    var name = el.getAttribute('name');
    if (name) {
      spf.net.resourcebeta.urls.set(type, name, [el.href]);
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
spf.net.stylebeta.get = function(url, opt_fn) {
  var type = spf.net.resourcebeta.Type.CSS;
  // NOTE: Callback execution depends on onload support and is best effort.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  return spf.net.resourcebeta.create(type, url, opt_fn);
};


/**
 * Executes any pending callbacks possible by checking if all pending
 * urls for a name have loaded.
 */
spf.net.stylebeta.check = function() {
  spf.debug.debug('style.check');
  var prefix = spf.net.stylebeta.prefix_('');
  for (var topic in spf.pubsub.subscriptions) {
    if (topic.indexOf(prefix) == 0) {
      var names = topic.substring(prefix.length).split('|');
      var ready = spf.array.every(names, spf.net.stylebeta.allLoaded_);
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
 * Prefetchs one or more styles; the styles will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the style when
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to prefetch.
 */
spf.net.stylebeta.prefetch = function(urls) {
  var type = spf.net.resourcebeta.Type.CSS;
  // Convert to an array if needed.
  urls = spf.array.toArray(urls);
  spf.array.each(urls, function(url) {
    spf.net.resourcebeta.prefetch(type, url);
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
spf.net.stylebeta.eval = function(text) {
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
spf.net.stylebeta.path = function(paths) {
  var type = spf.net.resourcebeta.Type.CSS;
  spf.net.resourcebeta.path(type, paths);
};


/**
 * Prefix a name to avoid conflicts.
 *
 * @param {?} name The name
 * @return {string} The prefixed name.
 * @private
 */
spf.net.stylebeta.prefix_ = function(name) {
  var type = spf.net.resourcebeta.Type.CSS;
  return spf.net.resourcebeta.prefix(type, name);
};


/**
 * Checks to see if a style exists.
 * (If a URL is loading or loaded, then it exists.)
 *
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 * @private
 */
spf.net.stylebeta.exists_ = function(url) {
  var type = spf.net.resourcebeta.Type.CSS;
  return spf.net.resourcebeta.exists(type, url);
};


/**
 * Checks to see if a style has been loaded.
 * (Falsey URL values (e.g. null or an empty string) are always "loaded".)
 *
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 * @private
 */
spf.net.stylebeta.loaded_ = function(url) {
  var type = spf.net.resourcebeta.Type.CSS;
  return spf.net.resourcebeta.loaded(type, url);
};


/**
 * Checks to see if all urls for a dependency have been loaded.
 * (Falsey dependency names (e.g. null or an empty string) are always "loaded".)
 *
 * @param {string} name The dependency name.
 * @return {boolean}
 * @private
 */
spf.net.stylebeta.allLoaded_ = function(name) {
  var type = spf.net.resourcebeta.Type.CSS;
  var urls = spf.net.resourcebeta.urls.get(type, name);
  return !name || (!!urls && spf.array.every(urls, spf.net.stylebeta.loaded_));
};
