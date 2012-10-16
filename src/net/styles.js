// Copyright 2012 Google Inc. All Rights Reserved.

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
  var head = document.getElementsByTagName('head')[0];
  // IE requires the Style element to be in the document before accessing
  // the StyleSheet object.
  head.appendChild(styleEl);
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
  linkEl = document.createElement('link');
  linkEl.id = id;
  linkEl.rel = 'stylesheet';
  linkEl.href = url;
  var head = document.getElementsByTagName('head')[0];
  head.appendChild(linkEl);
  return linkEl;
};


/**
 * "Unloads" a stylesheet URL by finding a previously created element and
 * removing it from the document.  This will remove the styles and allow a
 * URL to be loaded again if needed.
 *
 * @param {string} url Url of the script.
 */
spf.net.styles.unload = function(url) {
  var id = spf.net.styles.ID_PREFIX + spf.string.hashCode(url);
  var linkEl = document.getElementById(id);
  if (linkEl) {
    linkEl.parentNode.removeChild(linkEl);
  }
};


/**
 * Parses styles from an HTML string and installs them in the current
 * document.
 *
 * @param {string} html The complete HTML content to use as a source for
 *     updates.
 */
spf.net.styles.install = function(html) {
  if (!html) {
    return;
  }
  html.replace(spf.net.styles.LINK_TAG_REGEXP,
      function(fullMatch, attr) {
        var isStyleSheet = spf.string.contains(attr, 'rel="stylesheet"');
        if (isStyleSheet) {
          var url = attr.match(spf.net.styles.HREF_ATTR_REGEXP);
          if (url) {
            spf.net.styles.load(url[1]);
          }
        }
      });
  html.replace(spf.net.styles.STYLE_TAG_REGEXP,
      function(fullMatch, attr, text) {
        if (text) {
          spf.net.styles.eval(text);
        }
      });
};


/**
 * @type {string} The ID prefix for dynamically created style elements.
 * @const
 */
spf.net.styles.ID_PREFIX = 'css-';


/**
 * Regular expression used to locate link tags in a string.
 * See {@link #install}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.LINK_TAG_REGEXP = /\x3clink([\s\S]*?)\x3e/ig;


/**
 * Regular expression used to locate style tags in a string.
 * See {@link #install}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.STYLE_TAG_REGEXP =
    /\x3cstyle([\s\S]*?)\x3e([\s\S]*?)\x3c\/style/ig;


/**
 * Regular expression used to locate href attributes in a string.
 * See {@link #install}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.HREF_ATTR_REGEXP = /href="([\S]+)"/;
