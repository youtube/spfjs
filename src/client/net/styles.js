/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.styles');

goog.require('spf.debug');
goog.require('spf.net.resources');


/**
 * Marks all existing stylesheet URL elements in the document as loaded.
 */
spf.net.styles.mark = function() {
  spf.net.resources.mark(spf.net.resources.Type.CSS);
};


/**
 * Evaluates a set of styles by dynamically creating an element and appending it
 * to the document.
 *
 * @param {string} text The text of the style.
 * @return {undefined}
 */
spf.net.styles.eval = function(text) {
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
};


/**
 * Loads a stylesheet URL by dynamically creating an element and appending it
 * to the document.
 *
 * - Subsequent calls to load the same URL will not reload the stylesheet.
 *   This is done by giving each stylesheet a unique element id based on the
 *   URL and checking for it prior to loading.  To reload a stylesheet,
 *   unload it first.  See {@link #unload}.
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be execute each time, even if the script is not reloaded.
 *   NOTE: Unlike scripts, this callback is best effort and is supported
 *   in the following browser versions: IE 6, Chrome 19, Firefox 9, Safari 6.
 *
 * - A name can be specified to identify the same stylesheet at different URLs.
 *   (For example, "main-A.css" and "main-B.csss" are both "main".)  If a name
 *   is specified, all other stylesheet with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same stylesheet at different URLs.
 *
 * @param {string} url Url of the stylesheet.
 * @param {Function=} opt_callback Callback function to execute when the
 *     stylesheet is loaded (best-effort execution only).
 * @param {string=} opt_name Name to identify the stylesheet independently
 *     of the URL.
 * @return {Element} The dynamically created link element.
 */
spf.net.styles.load = function(url, opt_callback, opt_name) {
  return spf.net.resources.load(spf.net.resources.Type.CSS, url,
                                opt_callback, opt_name);
};


/**
 * "Unloads" a stylesheet URL by finding a previously created element and
 * removing it from the document.  This will remove the styles and allow a
 * URL to be loaded again if needed.
 *
 * NOTE: Unloading a style will prevent execution of ALL pending callbacks
 * but is NOT guaranteed to stop the browser loading a pending URL.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.unload = function(url) {
  spf.debug.warn('unloading stylesheet, canceling ALL pending callbacks',
                 'url=', url);
  spf.net.resources.unload(spf.net.resources.Type.CSS, url);
};


/**
 * "Ignores" a stylesheet load by canceling execution of a pending callback.
 *
 * @param {string} url Url of the stylesheet.
 * @param {Function} callback Callback function to cancel.
 */
spf.net.styles.ignore = function(url, callback) {
  spf.net.resources.ignore(spf.net.resources.Type.CSS, url, callback);
};


/**
 * Prefetches a stylesheet URL; the stylesheet will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the styesheet
 * when subsequently loaded.  See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.prefetch = function(url) {
  spf.net.resources.prefetch(spf.net.resources.Type.CSS, url);
};
