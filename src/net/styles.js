/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.styles');

goog.require('spf.string');


/**
 * Evaluates a set of styles by dynamically creating an element and appending it
 * to the document.
 *
 * @param {string} text The text of the style.
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
 * to the document.  Subsequent calls to load the same URL will not reload
 * the stylesheet.
 *
 * @param {string} url Url of the stylesheet.
 * @return {Element} The dynamically created link element.
 */
spf.net.styles.load = function(url) {
  var id = spf.net.styles.ID_PREFIX + spf.string.hashCode(url);
  var linkEl = document.getElementById(id);
  // If the stylesheet is already installed, return.
  if (linkEl) {
    return linkEl;
  }
  // Otherwise, the stylesheet needs to be installed.
  linkEl = spf.net.styles.load_(url, id);
  return linkEl;
};


/**
 * See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 * @param {string} id Id of the link element.
 * @param {Document} opt_document Content document element.
 * @return {Element} The dynamically created link element.
 * @private
 */
spf.net.styles.load_ = function(url, id, opt_document) {
  var linkEl = document.createElement('link');
  linkEl.id = id;
  linkEl.rel = 'stylesheet';
  linkEl.href = url;
  var doc = opt_document || document;
  var targetEl = doc.getElementsByTagName('head')[0] || doc.body;
  targetEl.appendChild(linkEl);
  return linkEl;
};


/**
 * "Unloads" a stylesheet URL by finding a previously created element and
 * removing it from the document.  This will remove the styles and allow a
 * URL to be loaded again if needed.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.unload = function(url) {
  var id = spf.net.styles.ID_PREFIX + spf.string.hashCode(url);
  var linkEl = document.getElementById(id);
  if (linkEl) {
    linkEl.parentNode.removeChild(linkEl);
  }
};


/**
 * Preloads a stylesheet URL; the stylesheet will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the styesheet
 * when subsequently loaded.  See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.preload = function(url) {
  var id = spf.net.styles.ID_PREFIX + 'preload';
  var iframeEl = document.getElementById(id);
  if (!iframeEl) {
    iframeEl = document.createElement('iframe');
    iframeEl.id = id;
    iframeEl.src = 'javascript:""';
    iframeEl.style.display = 'none';
    document.body.appendChild(iframeEl);
  }
  // Firefox needs the iframe to be fully created in the DOM before loading.
  setTimeout(function() {
    spf.net.styles.load_(url, '', iframeEl.contentWindow.document);
  }, 0);
};


/**
 * Parses an HTML string and installs styles in the current document.
 * See {@link #load} and {@link #eval}.
 *
 * @param {string} html The HTML content to parse.
 */
spf.net.styles.install = function(html) {
  if (!html) {
    return;
  }
  // Extract the styles.
  var queue = spf.net.styles.extract_(html);
  // Install the styles.
  for (var i = 0; i < queue.length; i++) {
    var pair = queue[i];
    var style = pair[0];
    var isUrl = pair[1];
    if (isUrl) {
      spf.net.styles.load(style);
    } else {
      spf.net.styles.eval(style);
    }
  }
};


/**
 * Parses an HTML string and preloads style URLs.
 * See {@link #preload}.
 *
 * @param {string} html The HTML content to parse.
 */
spf.net.styles.preinstall = function(html) {
  if (!html) {
    return;
  }
  // Extract the styles.
  var queue = spf.net.styles.extract_(html);
  // Preload the styles.
  for (var i = 0; i < queue.length; i++) {
    var pair = queue[i];
    var style = pair[0];
    var isUrl = pair[1];
    if (isUrl) {
      spf.net.styles.preload(style);
    }
  }
};


/**
 * Parses styles from an HTML string.
 *
 * @param {string} html The HTML content to parse.
 * @return {Array.<{0:string, 1:boolean}>}
 * @private
 */
spf.net.styles.extract_ = function(html) {
  var queue = [];
  html.replace(spf.net.styles.LINK_TAG_REGEXP,
      function(fullMatch, attr) {
        var isStyleSheet = spf.string.contains(attr, 'rel="stylesheet"');
        if (isStyleSheet) {
          var url = attr.match(spf.net.styles.HREF_ATTR_REGEXP);
          if (url) {
            queue.push([url[1], true]);
          }
        }
      });
  html.replace(spf.net.styles.STYLE_TAG_REGEXP,
      function(fullMatch, attr, text) {
        if (text) {
          queue.push([text, false]);
        }
      });
  return queue;
};


/**
 * @type {string} The ID prefix for dynamically created style elements.
 * @const
 */
spf.net.styles.ID_PREFIX = 'css-';


/**
 * Regular expression used to locate link tags in a string.
 * See {@link #extract_}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.LINK_TAG_REGEXP = /\x3clink([\s\S]*?)\x3e/ig;


/**
 * Regular expression used to locate style tags in a string.
 * See {@link #extract_}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.STYLE_TAG_REGEXP =
    /\x3cstyle([\s\S]*?)\x3e([\s\S]*?)\x3c\/style/ig;


/**
 * Regular expression used to locate href attributes in a string.
 * See {@link #extract_}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.HREF_ATTR_REGEXP = /href="([\S]+)"/;
