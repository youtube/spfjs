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
goog.require('spf.net.resource');
goog.require('spf.string');
goog.require('spf.tracing');


/**
 * Loads one or more styles asynchronously and optionally defines a name to
 * use for dependency management and unloading.  See {@link #unload} to
 * remove previously loaded styles.
 *
 * - Subsequent calls to load the same URL will not reload the style.  To
 *   reload a style, unload it first with {@link #unload}.  To unconditionally
 *   load a style, see {@link #get}.
 *
 * - A name can be specified to identify the same style at different URLs.
 *   (For example, "main-A.css" and "main-B.css" are both "main".)  If a name
 *   is specified, all other styles with the same name will be unloaded.
 *   This allows switching between versions of the same style at different URLs.
 *
 * - A callback can be specified to execute once the style has loaded.  The
 *   callback will be executed each time, even if the style is not reloaded.
 *   NOTE: Unlike scripts, this callback is best effort and is supported
 *   in the following browser versions: IE 6, Chrome 19, Firefox 9, Safari 6.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to load.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the styles
 *     or callback function to execute when the styles are loaded.
 * @param {Function=} opt_fn Optional callback function to execute when the
 *     styles are loaded.
 */
spf.net.style.load = function(urls, opt_nameOrFn, opt_fn) {
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.load(type, urls, opt_nameOrFn, opt_fn);
};


/**
 * Unloads styles identified by dependency name.  See {@link #load}.
 *
 * @param {string} name The dependency name.
 */
spf.net.style.unload = function(name) {
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.unload(type, name);
};


/**
 * Discovers existing styles in the document and registers them as loaded.
 */
spf.net.style.discover = function() {
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.discover(type);
};


/**
 * Unconditionally loads a style by dynamically creating an element and
 * appending it to the document without regard for whether it has been loaded
 * before. A style directly loaded by this method cannot be unloaded by name.
 * Compare to {@link #load}.
 *
 * @param {string} url The URL of the style to load.
 * @param {Function=} opt_fn Function to execute when loaded.
 */
spf.net.style.get = function(url, opt_fn) {
  // NOTE: Callback execution depends on onload support and is best effort.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.create(type, url, opt_fn);
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
 * Evaluates style text and defines a name to use for management.
 *
 * - Subsequent calls to evaluate the same text will not re-evaluate the style.
 *   To unconditionally evalute a style, see {@link #exec}.
 *
 * @param {string} text The text of the style.
 * @param {string} name Name to identify the style.
 * @return {undefined}
 */
spf.net.style.eval = function(text, name) {
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.eval(type, text, name);
};


/**
 * Unconditionally evaluates style text.  See {@link #eval}.
 *
 * @param {string} text The text of the style.
 */
spf.net.style.exec = function(text) {
  var type = spf.net.resource.Type.CSS;
  spf.net.resource.exec(type, text);
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


if (spf.tracing.ENABLED) {
  (function() {
    spf.net.style.load = spf.tracing.instrument(
        spf.net.style.load, 'spf.net.style.load');
    spf.net.style.unload = spf.tracing.instrument(
        spf.net.style.unload, 'spf.net.style.unload');
    spf.net.style.discover = spf.tracing.instrument(
        spf.net.style.discover, 'spf.net.style.discover');
    spf.net.style.get = spf.tracing.instrument(
        spf.net.style.get, 'spf.net.style.get');
    spf.net.style.prefetch = spf.tracing.instrument(
        spf.net.style.prefetch, 'spf.net.style.prefetch');
    spf.net.style.eval = spf.tracing.instrument(
        spf.net.style.eval, 'spf.net.style.eval');
    spf.net.style.path = spf.tracing.instrument(
        spf.net.style.path, 'spf.net.style.path');
  })();
}
