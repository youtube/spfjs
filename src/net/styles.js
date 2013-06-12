/**
 * @fileoverview Functions for dynamically loading styles.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.styles');

goog.require('spf.dom');
goog.require('spf.dom.dataset');
goog.require('spf.pubsub');
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
  var id = spf.net.styles.ID_PREFIX + spf.string.hashCode(url);
  var cls = opt_name || '';
  var linkEl = document.getElementById(id);
  var isLoaded = linkEl && spf.dom.dataset.get(linkEl, 'loaded');
  var isLoading = linkEl && !isLoaded;
  // If the stylesheet is already loaded, execute the callback(s) immediately.
  if (isLoaded) {
    if (opt_callback) {
      opt_callback();
    }
    return linkEl;
  }
  // Register the callback.
  if (opt_callback) {
    spf.pubsub.subscribe(id, opt_callback);
  }
  // If the stylesheet is currently loading, wait.
  if (isLoading) {
    return linkEl;
  }
  // Otherwise, the stylesheet needs to be loaded.
  // First, find old stylesheets to remove after loading, if any.
  var linkElsToRemove = cls ? spf.dom.query('link.' + cls) : [];
  // Lexical closures allow this trickiness with the "el" variable.
  var el = spf.net.styles.load_(url, id, cls, function() {
    if (!spf.dom.dataset.get(el, 'loaded')) {
      spf.dom.dataset.set(el, 'loaded', 'true');
      // Now that the stylesheet is loaded, remove old ones.
      // Only do this after a successful load to avoid prematurely removing
      // a stylesheet, which could lead to and unneeded stylesheet download
      // if load() is called again.
      spf.net.styles.unload_(linkElsToRemove);
      spf.pubsub.publish(id);
      spf.pubsub.clear(id);
    }
  });
  return el;
};


/**
 * See {@link #load}.
 *
 * @param {string} url Url of the stylesheet.
 * @param {string} id Id of the link element.
 * @param {string} cls Class of the link element.
 * @param {Function} fn Callback for when the link has loaded.
 * @param {Document=} opt_document Content document element.
 * @return {Element} The dynamically created link element.
 * @private
 */
spf.net.styles.load_ = function(url, id, cls, fn, opt_document) {
  var linkEl = document.createElement('link');
  linkEl.id = id;
  linkEl.className = cls;
  linkEl.rel = 'stylesheet';
  // The onload event for stylesheets is supported in IE 5.5, Firefox 9,
  // and WebKit 535.24 (Chrome 19 / Safari 6).
  linkEl.onload = function() {
    // IE 10 has a bug where it will synchronously call load handlers for
    // cached resources, we must force this to be async.
    if (fn) {
      setTimeout(fn, 0);
    }
  };
  // Set the onload handler before setting the href to avoid potential
  // IE bug where handlers are not called.
  linkEl.href = url;
  // Place the stylesheet in the head instead of the body to avoid errors when
  // called from the head in the first place.
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
    spf.net.styles.unload_([linkEl]);
  }
};


/**
 * See {@link unload}
 *
 * @param {Array.<Node>} linkEls The link elements.
 * @private
 */
spf.net.styles.unload_ = function(linkEls) {
  for (var i = 0; i < linkEls.length; i++) {
    spf.pubsub.clear(linkEls[i].id);
    linkEls[i].parentNode.removeChild(linkEls[i]);
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
    spf.net.styles.load_(url, id, '', null, iframeEl.contentWindow.document);
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
      spf.net.styles.load(item['url'], null, item['name']);
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
          var name = attr.match(spf.net.styles.CLASS_ATTR_REGEXP);
          name = name ? name[1] : '';
          result.queue.push({'url': url, 'text': '', 'name': name});
          return '';
        } else {
          return fullMatch;
        }
      });
  html = html.replace(spf.net.styles.STYLE_TAG_REGEXP,
      function(fullMatch, attr, text) {
        result.queue.push({'url': '', 'text': text, 'name': ''});
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
  /** @type {Array.<{url:string, text:string, name:string}>} */
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


/**
 * Regular expression used to locate class attributes in a string.
 * See {@link #parse}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.styles.CLASS_ATTR_REGEXP = /class="([\S]+)"/;
