/**
 * @fileoverview Functions for loading and unloading external resources,
 * currently limited to scripts and styles.
 * See {@link spf.net.scripts} and {@link spf.net.styles}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.resources');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.dom');
goog.require('spf.dom.dataset');
goog.require('spf.pubsub');
goog.require('spf.string');
goog.require('spf.tasks');
goog.require('spf.url');


/**
 * Marks all existing resource URL element in the document as loaded.  Can be
 * used to mark scripts or styles.  The id of the element will be set and used
 * to identify the script or style and prevent reloading the resource.  Elements
 * with pre-existing ids will be ignored.
 *
 * @param {spf.net.resources.Type} type Type of the resource.
 */
spf.net.resources.mark = function(type) {
  var isJS = type == spf.net.resources.Type.JS;
  var selector = isJS ? 'script[src]' : 'link[rel~="stylesheet"]';
  var els = spf.dom.query(selector);
  for (var i = 0, l = els.length; i < l; i++) {
    if (!els[i].id) {
      var url = isJS ? els[i].src : els[i].href;
      var id = spf.net.resources.id_(type, url);
      els[i].id = id;
      spf.dom.dataset.set(els[i], 'loaded', 'true');
    }
  }
};


/**
 * Loads a resource URL by dynamically creating an element and appending it to
 * the document.  Can be used to load scripts or styles.
 *
 * - Subsequent calls to load the same URL will not reload the resource.
 *   This is done by giving each resource a unique element id based on the
 *   URL and checking for it prior to loading.  To reload a resource,
 *   unload it first.  See {@link #unload}.
 *
 * - A callback can be specified to execute once the resource has loaded.  The
 *   callback will be execute each time, even if the resource is not reloaded.
 *   NOTE: Unlike scripts, callbacks for styles are best effort only and are
 *   supported in the following browser versions: IE 6, Chrome 19, Firefox 9,
 *   Safari 6.
 *
 * - A name can be specified to identify the same resource at different URLs.
 *   (For example, "main-A.js" and "main-B.js" are both "main".)  If a name
 *   is specified, all other resources with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same resource at different URLs.
 *
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @param {Function=} opt_callback Callback function to execute when the
 *     resource is loaded.
 * @param {string=} opt_name Name to identify the resource independently
 *     of the URL.
 * @return {Element} The dynamically created element.
 */
spf.net.resources.load = function(type, url, opt_callback, opt_name) {
  if (!url) {
    return null;
  }
  var id = spf.net.resources.id_(type, url);
  var cls = opt_name || '';
  var el = document.getElementById(id);
  var isLoaded = el && spf.dom.dataset.get(el, 'loaded');
  var isLoading = el && !isLoaded;
  // If the resource is already loaded, execute the callback(s) immediately.
  if (isLoaded) {
    if (opt_callback) {
      opt_callback();
    }
    return el;
  }
  // Register the callback.
  if (opt_callback) {
    spf.pubsub.subscribe(id, opt_callback);
  }
  // If the resource is currently loading, return to allow it to finish.
  if (isLoading) {
    return el;
  }
  // Otherwise, the resource needs to be loaded.
  var isJS = type == spf.net.resources.Type.JS;
  // First, find old resources to remove after loading, if any.
  var tag = isJS ? 'script' : 'link';
  var elsToRemove = cls ? spf.dom.query(tag + '.' + cls) : [];
  var key = isJS ? 'script-loading-callback' : 'style-loading-callback';
  var val = spf.execute(/** @type {Function} */ (
      spf.config.get(key)), url, cls);
  // Lexical closures allow this trickiness with the "el" variable.
  el = spf.net.resources.load_(type, url, id, cls, function() {
    if (!spf.dom.dataset.get(el, 'loaded')) {
      spf.dom.dataset.set(el, 'loaded', 'true');
      // Now that the resource is loaded, remove old ones.
      // Only done after load to avoid prematurely removing resources.
      spf.net.resources.unload_(elsToRemove);
      // Execute callbacks.
      spf.pubsub.publish(id);
      spf.pubsub.clear(id);
    }
  });
  return el;
};


/**
 * See {@link #load}.
 *
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @param {string} id Id of the element.
 * @param {string} cls Class of the element.
 * @param {Function} fn Callback for when the element has loaded.
 * @param {Document=} opt_document Content document element.
 * @return {Element} The dynamically created element.
 * @private
 */
spf.net.resources.load_ = function(type, url, id, cls, fn, opt_document) {
  var isJS = type == spf.net.resources.Type.JS;
  var tag = isJS ? 'script' : 'link';
  var el = document.createElement(tag);
  el.id = id;
  el.className = cls;
  if (isJS) {
    el.async = true;
  } else {
    el.rel = 'stylesheet';
  }
  // Chrome, Safari, Firefox, Opera and IE 9 support script onload.
  // Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 support stylesheet onload.
  // To support scripts IE 8 and below, use script onreadystatechange.
  var loaded = false;
  el.onload = function() {
    // Prevent multiple callback execution in IE 9+ where both onload and
    // onreadystatechange will be executed.
    if (!loaded) {
      loaded = true;
      el.onload = el.onreadystatechange = null;
      // IE 10 has a bug where it will synchronously call load handlers for
      // cached resources, we must force this to be async.
      if (fn) {
        setTimeout(fn, 0);
      }
    }
  };
  el.onerror = el.onload;
  el.onreadystatechange = function() {
    if (/complete|loaded/.test(el.readyState)) {
      el.onload(null);
    }
  };
  // For scripts, set the onload and onreadystatechange handlers before
  // setting the src to avoid potential IE bug where handlers are not called.
  if (isJS) {
    el.src = url;
  } else {
    el.href = url;
  }
  // Place the resources in the head instead of the body to avoid errors when
  // called from the head in the first place.
  var doc = opt_document || document;
  var targetEl = doc.getElementsByTagName('head')[0] || doc.body;
  if (isJS) {
    // Use insertBefore instead of appendChild to avoid errors with loading
    // multiple scripts at once in IE.
    targetEl.insertBefore(el, targetEl.firstChild);
  } else {
    // Use appendChild for CSS because we must preserve the order.
    targetEl.appendChild(el);
  }
  return el;
};


/**
 * Unloads a resource URL by finding a previously created element and
 * removing it from the document. This will allow a URL to be loaded again
 * if needed.
 *
 * WARNING: Unloading a resource will prevent execution of ALL pending callbacks
 * but is NOT guaranteed to stop the browser loading a pending URL.
 *
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 */
spf.net.resources.unload = function(type, url) {
  if (!url) {
    return;
  }
  var id = spf.net.resources.id_(type, url);
  var el = document.getElementById(id);
  if (el) {
    spf.net.resources.unload_([el]);
  }
};


/**
 * See {@link unload}.
 *
 * @param {Array.<Node>|NodeList} els The elements.
 * @private
 */
spf.net.resources.unload_ = function(els) {
  for (var i = 0, l = els.length; i < l; i++) {
    spf.pubsub.clear(els[i].id);
    els[i].parentNode.removeChild(els[i]);
  }
};


/**
 * "Ignores" a resource load by canceling execution of a pending callback.
 *
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @param {Function} callback Callback function to cancel.
 */
spf.net.resources.ignore = function(type, url, callback) {
  if (!url || !callback) {
    return;
  }
  var id = spf.net.resources.id_(type, url);
  spf.pubsub.unsubscribe(id, callback);
};


/**
 * Prefetches a resource URL; the resource will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the resource
 * when subsequently loaded.  See {@link #load}.
 *
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 */
spf.net.resources.prefetch = function(type, url) {
  if (!url) {
    return;
  }
  var id = spf.net.resources.id_(type, url);
  var el = document.getElementById(id);
  // If the resource is already loaded, return.
  if (el) {
    return;
  }
  var iframeId = type + '-prefetch';
  var iframeEl =
      /** @type {HTMLIFrameElement} */ (document.getElementById(iframeId));
  if (!iframeEl) {
    iframeEl = spf.dom.createIframe(iframeId, null, function(loadedIframeEl) {
      // Set the iframe's loaded flag.
      spf.dom.dataset.set(loadedIframeEl, 'loaded', 'true');
      spf.tasks.run(iframeId, true);
    });
  } else {
    // If the resource is already prefetched, return.
    el = iframeEl.contentWindow.document.getElementById(id);
    if (el) {
      return;
    }
  }

  // Firefox needs the iframe to be fully created in the DOM before continuing.
  // So delay adding elements to the iframe until onload.
  if (!spf.dom.dataset.get(iframeEl, 'loaded')) {
    spf.tasks.add(iframeId,
        spf.bind(spf.net.resources.loadResourceInIframe_, null,
                 iframeEl, type, url, id));
  } else {
    spf.net.resources.loadResourceInIframe_(iframeEl, type, url, id);
  }
};


/**
 * See {@link #prefetch}.
 *
 * @param {HTMLIFrameElement} iframeEl The iframe to load resources in.
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @param {string} id The computed unique id of the resource.
 * @private
 */
spf.net.resources.loadResourceInIframe_ = function(iframeEl, type, url, id) {
  var isJS = type == spf.net.resources.Type.JS;
  var iframeDoc = iframeEl.contentWindow.document;
  if (isJS) {
    var fetchEl = iframeDoc.createElement('object');
    if (spf.net.resources.IS_IE) {
      // IE needs a <script> in order to complete the request, but
      // fortunately will not execute it unless in the DOM.  Attempting to
      // use an <object> like other browsers will cause the download to hang.
      // The <object> will just be a placeholder for the request made.
      var extraElForIE = iframeDoc.createElement('script');
      extraElForIE.src = url;
    } else {
      // Otherwise scripts need to be prefetched as objects to avoid execution.
      fetchEl.data = url;
    }
    fetchEl.id = id;
    iframeDoc.body.appendChild(fetchEl);
  } else {
    // Stylesheets can be prefetched in the same way as loaded.
    spf.net.resources.load_(type, url, id, '', null, iframeDoc);
  }
};


/**
 * @param {spf.net.resources.Type} type Type of the resource.
 * @param {string} url Url of the resource.
 * @return {string} The unique id of the resource.
 * @private
 */
spf.net.resources.id_ = function(type, url) {
  var absolute = spf.url.absolute(url);
  var unprotocol = spf.url.unprotocol(absolute);
  var hash = spf.string.hashcode(unprotocol);
  return type + '-' + hash;
};


/**
 * @type {boolean} Whether the browser is Internet Explorer; valid for
 * MSIE 8+ aka Trident 4+.
 * @const
 */
spf.net.resources.IS_IE = spf.string.contains(navigator.userAgent, ' Trident/');


/**
 * Supported resource types.
 * @enum {string}
 */
spf.net.resources.Type = {
  CSS: 'css',
  JS: 'js'
};
