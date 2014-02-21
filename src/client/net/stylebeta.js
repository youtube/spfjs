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
  spf.debug.debug('script.load', urls, name);

  if (name) {
    var loaded = spf.array.every(urls, spf.net.stylebeta.loaded_);
    var previous = spf.net.resourcebeta.urls.get(type, name);
    // If loading new styles for a name, handle unloading previous ones.
    if (!loaded && previous) {
      spf.net.stylebeta.unload(name);
    }
    // Associate the styles with the name to allow unloading.
    spf.net.resourcebeta.urls.set(type, name, urls);
  }

  spf.array.each(urls, function(url) {
    // If a status exists, the style is already loading or loaded.
    if (url && !spf.net.stylebeta.exists_(url)) {
      var el = spf.net.stylebeta.get(url);
      if (name) {
        el.title = name;
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
  if (urls.length) {
    spf.debug.warn('  >', urls);
    spf.dispatch('cssunload', name);
    spf.array.each(urls, function(url) {
      spf.net.resourcebeta.destroy(type, url);
    });
  }
  spf.net.resourcebeta.urls.clear(type, name);
};


/**
 * Discovers existing styles in the document and registers them as loaded.
 */
spf.net.stylebeta.discover = function() {
  spf.debug.debug('style.discover');
  var type = spf.net.resourcebeta.Type.CSS;
  var els = spf.net.resourcebeta.discover(type);
  spf.array.each(els, function(el) {
    if (el.title) {
      spf.net.resourcebeta.urls.set(type, el.title, [el.href]);
    }
    spf.debug.debug('  found', el.href, el.title);
  });
};


/**
 * Unconditionally loads a style by dynamically creating an element and
 * appending it to the document without regard for whether it has been loaded
 * before. A style directly loaded by this method cannot be unloaded by name.
 * Compare to {@link #load}.
 *
 * @param {string} url The URL of the style to load.
 * @return {Element} The newly created element.
 */
spf.net.stylebeta.get = function(url) {
  var type = spf.net.resourcebeta.Type.CSS;
  return spf.net.resourcebeta.create(type, url);
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
 * Sets the path to use when resolving relative URLs.
 *
 * @param {string} path The path.
 */
spf.net.stylebeta.path = function(path) {
  var type = spf.net.resourcebeta.Type.CSS;
  spf.net.resourcebeta.path(type, path);
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
