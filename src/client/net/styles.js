/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.styles');

goog.require('spf.net.resources');
goog.require('spf.string');


/**
 * Marks all existing stylesheet URL elements in the document as loaded.
 */
spf.net.styles.mark = function() {
  spf.net.resources.mark('css');
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
  return spf.net.resources.load('css', url, opt_callback, opt_name);
};


/**
 * "Unloads" a stylesheet URL by finding a previously created element and
 * removing it from the document.  This will remove the styles and allow a
 * URL to be loaded again if needed.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.unload = function(url) {
  spf.net.resources.unload('css', url);
};


/**
 * "Ignores" a stylesheet load by canceling execution of any pending callbacks;
 * does not stop the actual loading of the stylesheet.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.ignore = function(url) {
  spf.net.resources.ignore('css', url);
};


/**
 * Prefetches a stylesheet URL; the stylesheet will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the styesheet
 * when subsequently loaded.  See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.prefetch = function(url) {
  spf.net.resources.prefetch('css', url);
};


/**
 * Installs styles that have been parsed from an HTML string.
 * See {@link #load}, {@link #eval}, and {@link #parse}.
 *
 * @param {!spf.net.styles.ParseResult} result The parsed HTML result.
 */
spf.net.styles.install = function(result) {
  if (result.styles.length <= 0) {
    return;
  }
  // Install the styles.
  for (var i = 0, l = result.styles.length; i < l; i++) {
    var item = result.styles[i];
    if (item.url) {
      spf.net.styles.load(item.url, null, item.name);
    } else if (item.text) {
      spf.net.styles.eval(item.text);
    }
  }
};


/**
 * Parses an HTML string and prefetches style URLs.
 * See {@link #prefetch} and {@link #parse}.
 *
 * @param {!spf.net.styles.ParseResult} result The parsed HTML result.
 */
spf.net.styles.preinstall = function(result) {
  if (result.styles.length <= 0) {
    return;
  }
  // Prefetch the styles.
  for (var i = 0, l = result.styles.length; i < l; i++) {
    var item = result.styles[i];
    if (item.url) {
      spf.net.styles.prefetch(item.url);
    }
  }
};


/**
 * Parses styles from an HTML string.
 *
 * @param {string} html The HTML content to parse.
 * @return {!spf.net.styles.ParseResult}
 */
spf.net.styles.parse = function(html) {
  var result = new spf.net.styles.ParseResult();
  if (!html) {
    return result;
  }
  html = html.replace(spf.net.styles.LINK_TAG_REGEXP,
      function(fullMatch, attr) {
        var isStyleSheet = spf.string.contains(attr, 'rel="stylesheet"');
        if (isStyleSheet) {
          var url = attr.match(spf.net.styles.HREF_ATTR_REGEXP);
          url = url ? url[1] : '';
          var name = attr.match(spf.net.styles.CLASS_ATTR_REGEXP);
          name = name ? name[1] : '';
          result.styles.push({url: url, text: '', name: name});
          return '';
        } else {
          return fullMatch;
        }
      });
  html = html.replace(spf.net.styles.STYLE_TAG_REGEXP,
      function(fullMatch, attr, text) {
        result.styles.push({url: '', text: text, name: ''});
        return '';
      });
  result.html = html;
  return result;
};


/**
 * A container for holding the result of parsing styles from an HTML string.
 * @constructor
 */
spf.net.styles.ParseResult = function() {
  /** @type {string} */
  this.html = '';
  /** @type {Array.<{url:string, text:string, name:string}>} */
  this.styles = [];
};


/**
 * Regular expression used to locate link tags in a string.
 * See {@link #parse}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.LINK_TAG_REGEXP = /\x3clink([\s\S]*?)\x3e/ig;


/**
 * Regular expression used to locate style tags in a string.
 * See {@link #parse}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.STYLE_TAG_REGEXP =
    /\x3cstyle([\s\S]*?)\x3e([\s\S]*?)\x3c\/style/ig;


/**
 * Regular expression used to locate href attributes in a string.
 * See {@link #parse}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.HREF_ATTR_REGEXP = /href="([\S]+)"/;


/**
 * Regular expression used to locate class attributes in a string.
 * See {@link #parse}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.CLASS_ATTR_REGEXP = /class="([\S]+)"/;
