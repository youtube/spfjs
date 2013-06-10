/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.styles');

goog.require('spf.dom');
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
  // If the stylesheet is already loaded, return.
  if (linkEl) {
    return linkEl;
  }
  // Otherwise, the stylesheet needs to be loaded.
  linkEl = spf.net.styles.load_(url, id);
  return linkEl;
};


/**
 * See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 * @param {string} id Id of the link element.
 * @param {Document=} opt_document Content document element.
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
 * Prefetches a stylesheet URL; the stylesheet will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the styesheet
 * when subsequently loaded.  See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.net.styles.prefetch = function(url) {
  var id = spf.net.styles.ID_PREFIX + spf.string.hashCode(url);
  var linkEl = document.getElementById(id);
  // If the stylesheet is already loaded, return.
  if (linkEl) {
    return linkEl;
  }
  var iframeId = spf.net.styles.ID_PREFIX + 'prefetch';
  var iframeEl = document.getElementById(iframeId);
  if (!iframeEl) {
    iframeEl = spf.dom.createIframe(iframeId);
  } else {
    // If the stylesheet is already prefetched, return.
    linkEl = iframeEl.contentWindow.document.getElementById(id);
    if (linkEl) {
      return;
    }
  }
  // Firefox needs the iframe to be fully created in the DOM before continuing.
  setTimeout(function() {
    spf.net.styles.load_(url, id, iframeEl.contentWindow.document);
  }, 0);
};


/**
 * Installs styles that have been parsed from an HTML string.
 * See {@link #load}, {@link #eval}, and {@link #parse}.
 *
 * @param {!spf.net.styles.ParseResult} result The parsed HTML result.
 */
spf.net.styles.install = function(result) {
  if (result.queue.length <= 0) {
    return;
  }
  // Install the styles.
  for (var i = 0; i < result.queue.length; i++) {
    var item = result.queue[i];
    if (item['url']) {
      spf.net.styles.load(item['url']);
    } else if (item['text']) {
      spf.net.styles.eval(item['text']);
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
  if (result.queue.length <= 0) {
    return;
  }
  // Prefetch the styles.
  for (var i = 0; i < result.queue.length; i++) {
    var item = result.queue[i];
    if (item['url']) {
      spf.net.styles.prefetch(item['url']);
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
  result.original = html;
  html = html.replace(spf.net.styles.LINK_TAG_REGEXP,
      function(fullMatch, attr) {
        var isStyleSheet = spf.string.contains(attr, 'rel="stylesheet"');
        if (isStyleSheet) {
          var url = attr.match(spf.net.styles.HREF_ATTR_REGEXP);
          url = url ? url[1] : '';
          result.queue.push({'url': url, 'text': ''});
          return '';
        } else {
          return fullMatch;
        }
      });
  html = html.replace(spf.net.styles.STYLE_TAG_REGEXP,
      function(fullMatch, attr, text) {
        result.queue.push({'url': '', 'text': text});
        return '';
      });
  result.parsed = html;
  return result;
};


/**
 * A container for holding the result of parsing styles from an HTML string.
 * @constructor
 */
spf.net.styles.ParseResult = function() {
  /** @type {string} */
  this.original = '';
  /** @type {string} */
  this.parsed = '';
  /** @type {Array.<{url:string, text:string}>} */
  this.queue = [];
};


/**
 * @type {string} The ID prefix for dynamically created style elements.
 * @const
 */
spf.net.styles.ID_PREFIX = 'css-';


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
