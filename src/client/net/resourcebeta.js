/**
 * @fileoverview Functions for loading and unloading external resources such
 * as scripts and styles.
 * See {@link spf.net.scriptbeta}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.resourcebeta');

goog.require('spf');


/**
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @param {Function} opt_callback Callback for when the resource has loaded.
 * @param {Document=} opt_document Content document element.
 * @return {Element} The dynamically created element.
 */
spf.net.resourcebeta.get = function(type, url, opt_callback, opt_document) {
  var next = function() {
    // IE 10 has a bug where it will synchronously call load handlers for
    // cached resources, force this to be async for consistency.
    if (opt_callback) {
      setTimeout(opt_callback, 0);
    }
    return null;
  };
  if (!url) {
    return next();
  }
  // When built for the script loader, always assume JS is being loaded.
  if (SPF_BOOTLOADER) {
    var isJS = true;
  } else {
    var isJS = type == spf.net.resourcebeta.Type.JS;
  }
  var tag = isJS ? 'script' : 'link';
  var doc = opt_document || document;
  var el = doc.createElement(tag);
  // Chrome, Safari, Firefox, Opera and IE 9 support script onload.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  // To support scripts IE 8 and below, use script onreadystatechange.
  if ('onload' in el) {
    el.onerror = el.onload = next;
  } else {
    el.onreadystatechange = function() {
      // For IE 8 and below, script readyState will be one of the following:
      // * uninitialized
      // * loading
      // * loaded
      // * interactive
      // * complete
      // Match either "loaded" or "complete" to provide the equivalent of
      // script onload.  (Note that "interactive" can be skipped).
      if (/^c|loade/.test(el.readyState)) {
        next();
      }
    };
  }
  // For scripts, set the onload and onreadystatechange handlers before
  // setting the src to avoid potential IE bug where handlers are not called.
  // Place resources in the head instead of the body to avoid errors when
  // called from the head in the first place.
  var head = doc.getElementsByTagName('head')[0];
  if (isJS) {
    el.async = true;
    el.src = url;
    // Use insertBefore for JS to avoid IE execution errors.
    head.insertBefore(el, head.firstChild);
  } else {
    el.rel = 'stylesheet';
    el.href = url;
     // Use appendChild for CSS because to preserve order.
    head.appendChild(el);
  }
  return el;
};


/**
 * Supported resource types.
 * @enum {string}
 */
spf.net.resourcebeta.Type = {
  CSS: 'css',
  JS: 'js'
};
