/**
 * @fileoverview Functions for loading and unloading external resources such
 * as scripts and styles.
 * See {@link spf.net.scriptbeta}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.resourcebeta');

goog.require('spf');
goog.require('spf.tasks');


/**
 * Loads a resource by creating an element and appending it to the document.
 *
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
 * Remove a previously created element that was appended to the document.
 * See {@link #load}.
 *
 * @param {Element} el A created element
 */
spf.net.resourcebeta.remove = function(el) {
  if (el.parentNode) {
    el.parentNode.removeChild(el);
  }
};


/**
 * Prefetches a resource by creating a dummy element and appending it to an
 * iframe document.  The resource will be requested but not loaded. Use to
 * prime the browser cache and avoid needing to request the resource when
 * subsequently loaded.  See {@link #get}.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 */
spf.net.resourcebeta.prefetch = function(type, url) {
  if (!url) {
    return;
  }
  var id = type + '-' + spf.net.resourcebeta.label(url);
  var key = type + '-prefetch';
  var el = /** @type {HTMLIFrameElement} */ (document.getElementById(key));
  if (!el) {
    el = spf.dom.createIframe(key, null, function(el) {
      // Set the iframe's loaded flag.
      el.title = 'loaded';
      spf.tasks.run(key, true);
    });
  } else {
    // If the resource is already prefetched, return.
    if (el.contentWindow.document.getElementById(id)) {
      return;
    }
  }
  // Firefox needs the iframe to be fully created in the DOM before continuing.
  // So delay adding elements to the iframe until onload.
  var next = spf.bind(spf.net.resourcebeta.prefetch_, null, el, type, url, id);
  if (!el.title) {
    spf.tasks.add(key, next);
  } else {
    next();
  }
};


/**
 * See {@link #prefetch}.
 *
 * @param {HTMLIFrameElement} el The iframe to load resources in.
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @param {string} id The computed unique id of the resource.
 * @private
 */
spf.net.resourcebeta.prefetch_ = function(el, type, url, id) {
  var isJS = type == spf.net.resourcebeta.Type.JS;
  var doc = el.contentWindow.document;
  if (isJS) {
    var fetchEl = doc.createElement('object');
    if (spf.net.resourcebeta.IS_IE) {
      // IE needs a <script> in order to complete the request, but
      // fortunately will not execute it unless in the DOM.  Attempting to
      // use an <object> like other browsers will cause the download to hang.
      // The <object> will just be a placeholder for the request made.
      var extraElForIE = doc.createElement('script');
      extraElForIE.src = url;
    } else {
      // Otherwise scripts need to be prefetched as objects to avoid execution.
      fetchEl.data = url;
    }
    fetchEl.id = id;
    doc.body.appendChild(fetchEl);
  } else {
    // Stylesheets can be prefetched in the same way as loaded.
    var fetchEl = spf.net.resourcebeta.get(type, url, null, doc);
    fetchEl.id = id;
  }
};


/**
 * Convert a URL to an internal "name" for use in identifying it.
 *
 * @param {string} url The resource URL.
 * @return {string} The name.
 */
spf.net.resourcebeta.label = function(url) {
  return url ? url.replace(/[^\w]/g, '') : '';
};


/**
 * Whether the browser is Internet Explorer; valid for MSIE 8+ aka Trident 4+.
 * @type {boolean}
 * @const
 */
spf.net.resourcebeta.IS_IE = spf.string.contains(
    navigator.userAgent, ' Trident/');


/**
 * Supported resource types.
 * @enum {string}
 */
spf.net.resourcebeta.Type = {
  CSS: 'css',
  JS: 'js'
};
