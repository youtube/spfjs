/**
 * @fileoverview Functions for loading and unloading external resources such
 * as scripts and styles.
 * See {@link spf.net.scriptbeta} and {@link spf.net.stylebeta}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.resourcebeta');

goog.require('spf');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.tasks');


/**
 * Loads a resource by creating an element and appending it to the document.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 * @param {Function=} opt_callback Callback for when the resource has loaded.
 * @param {Document=} opt_document Content document element.
 * @return {Element} The dynamically created element.
 */
spf.net.resourcebeta.create = function(type, url, opt_callback, opt_document) {
  spf.debug.debug('resource.create', url, 'loading');
  // When built for the bootloader, always assume JS is being loaded.
  var isJS = SPF_BOOTLOADER || type == spf.net.resourcebeta.Type.JS;
  url = spf.net.resourcebeta.canonicalize(type, url);
  spf.net.resourcebeta.stats_[url] = spf.net.resourcebeta.Status.LOADING;
  var next = function() {
    spf.debug.debug('resource.create', url, 'done');
    // Only update status if the resource has not been removed in the interim.
    if (spf.net.resourcebeta.stats_[url]) {
      spf.debug.debug('resource.create', url, 'loaded');
      spf.net.resourcebeta.stats_[url] = spf.net.resourcebeta.Status.LOADED;
    }
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
  var tag = isJS ? 'script' : 'link';
  var doc = opt_document || document;
  var el = doc.createElement(tag);
  var name = spf.net.resourcebeta.label(url);
  el.className = spf.net.resourcebeta.prefix(type, name);
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
 * Unloads a resource by removing a previously created element that was
 * appended to the document.
 * See {@link #create}.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 */
spf.net.resourcebeta.destroy = function(type, url) {
  url = spf.net.resourcebeta.canonicalize(type, url);
  var name = spf.net.resourcebeta.label(url);
  var cls = spf.net.resourcebeta.prefix(type, name);
  var els = spf.dom.query('.' + cls);
  spf.array.each(els, function(el) {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
  delete spf.net.resourcebeta.stats_[url];
};


/**
 * Discovers existing resources in the document and registers them as loaded.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @return {Array.<Node>|NodeList} The newly found elements.
 */
spf.net.resourcebeta.discover = function(type) {
  spf.debug.debug('resource.discover', type);
  var isJS = type == spf.net.resourcebeta.Type.JS;
  var selector = isJS ? 'script[src]' : 'link[rel~="stylesheet"]';
  var els = [];
  spf.array.each(spf.dom.query(selector), function(el) {
    var url = isJS ? el.src : el.href;
    url = spf.net.resourcebeta.canonicalize(type, url);
    // Ignore if already loading or loaded.
    if (!spf.net.resourcebeta.stats_[url]) {
      spf.net.resourcebeta.stats_[url] = spf.net.resourcebeta.Status.LOADED;
      var name = spf.net.resourcebeta.label(url);
      var cls = spf.net.resourcebeta.prefix(type, name);
      spf.dom.classlist.add(el, cls);
      els.push(el);
      spf.debug.debug('  found', url, cls);
    }
  });
  return els;
};


/**
 * Prefetches a resource by creating a dummy element and appending it to an
 * iframe document.  The resource will be requested but not loaded. Use to
 * prime the browser cache and avoid needing to request the resource when
 * subsequently loaded.  See {@link #get}.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 */
spf.net.resourcebeta.prefetch = function(type, url) {
  if (!url) {
    return;
  }
  url = spf.net.resourcebeta.canonicalize(type, url);
  if (spf.net.resourcebeta.stats_[url]) {
    return;
  }
  var name = spf.net.resourcebeta.label(url);
  var id = spf.net.resourcebeta.prefix(type, name);
  var key = spf.net.resourcebeta.prefix(type, 'prefetch');
  var el = /** @type {HTMLIFrameElement} */ (document.getElementById(key));
  if (!el) {
    el = spf.dom.createIframe(key, null, function(el) {
      // Use the title attribute as the iframe's loaded flag.
      el.title = key;
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
 * @param {string} url URL of the resource.
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
    var fetchEl = spf.net.resourcebeta.create(type, url, null, doc);
    fetchEl.id = id;
  }
};


/**
 * Associates a list of resource URLs with a dependency name.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @param {Array.<string>} urls The URLs.
 */
spf.net.resourcebeta.register = function(type, name, urls) {
  var key = spf.net.resourcebeta.prefix(type, name);
  spf.net.resourcebeta.urls_[key] = urls;
};


/**
 * Unassociates any previously associated URLs for a dependency name.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} name The dependency name.
 */
spf.net.resourcebeta.unregister = function(type, name) {
  var key = spf.net.resourcebeta.prefix(type, name);
  delete spf.net.resourcebeta.urls_[key];
};


/**
 * Returns the list of URLs currently associated with a dependency name.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @return {Array.<string>} The URLs.
 */
spf.net.resourcebeta.list = function(type, name) {
  var key = spf.net.resourcebeta.prefix(type, name);
  return spf.net.resourcebeta.urls_[key];
};


/**
 * Sets the base path to use when resolving relative URLs.
 * See {@link #canonicalize}.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} path The path.
 */
spf.net.resourcebeta.path = function(type, path) {
  var key = spf.net.resourcebeta.PATHS_KEY_PREFIX + type;
  spf.state.set(key, path);
};


/**
 * Convert a resource URL to the "canonical" version by prepending the base path
 * and appending a suffix if needed.  See {@link #path}.  Ignores absolute URLs
 * (i.e. those that start with http://, etc).
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url The initial url.
 * @return {string} The adjusted url.
 */
spf.net.resourcebeta.canonicalize = function(type, url) {
  var key = spf.net.resourcebeta.PATHS_KEY_PREFIX + type;
  if (url && url.indexOf('//') < 0) {
    url = (spf.state.get(key) || '') + url;
    url = url.indexOf('.' + type) < 0 ? url + '.' + type : url;
  }
  return url;
};


/**
 * Checks to see if a resource exists.
 * (If a URL is loading or loaded, then it exists.)
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 */
spf.net.resourcebeta.exists = function(type, url) {
  url = spf.net.resourcebeta.canonicalize(type, url);
  return !!spf.net.resourcebeta.stats_[url];
};


/**
 * Checks to see if a resource has been loaded.
 * (Falsey URL values (e.g. null or an empty string) are always "loaded".)
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 */
spf.net.resourcebeta.loaded = function(type, url) {
  var status = 0;
  if (url) {
    url = spf.net.resourcebeta.canonicalize(type, url);
    status = spf.net.resourcebeta.stats_[url];
  }
  return status == spf.net.resourcebeta.Status.LOADED;
};



/**
 * Prefix a name to avoid conflicts.
 *
 * @param {spf.net.resourcebeta.Type} type Type of the resource.
 * @param {?} name The name
 * @return {string} The prefixed name.
 */
spf.net.resourcebeta.prefix = function(type, name) {
  return type + '-' + name;
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
 * Map a url to a resource status.
 * @type {!Object.<spf.net.resourcebeta.Status>}
 * @private
 */
spf.net.resourcebeta.stats_ = {};
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.net.resourcebeta.STATS_KEY, spf.net.resourcebeta.stats_);
} else if (SPF_BETA) {
  if (!spf.state.has(spf.net.resourcebeta.STATS_KEY)) {
    spf.state.set(spf.net.resourcebeta.STATS_KEY, {});
  }
  spf.net.resourcebeta.stats_ =
      /** @type {!Object.<spf.net.resourcebeta.Status>} */ (
      spf.state.get(spf.net.resourcebeta.STATS_KEY));
}


/**
 * Map a dependency name to associated urls.
 * @type {!Object.<Array.<string>>}
 * @private
 */
spf.net.resourcebeta.urls_ = {};
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.net.resourcebeta.URLS_KEY, spf.net.resourcebeta.urls_);
} else if (SPF_BETA) {
  if (!spf.state.has(spf.net.resourcebeta.URLS_KEY)) {
    spf.state.set(spf.net.resourcebeta.URLS_KEY, {});
  }
  spf.net.resourcebeta.urls_ = /** @type {!Object.<Array.<string>>} */ (
      spf.state.get(spf.net.resourcebeta.URLS_KEY));
}


/**
 * Key used to store and retrieve resource status in state.
 * @type {string}
 * @const
 */
spf.net.resourcebeta.STATS_KEY = 'rsrc-s';


/**
 * Key used to store and retrieve resource urls in state.
 * @type {string}
 * @const
 */
spf.net.resourcebeta.URLS_KEY = 'rsrc-u';


/**
 * Key prefix used to store and retrieve base paths in state.
 * @type {string}
 * @const
 */
spf.net.resourcebeta.PATHS_KEY_PREFIX = 'rsrc-p-';


/**
 * Whether the browser is Internet Explorer; valid for MSIE 8+ aka Trident 4+.
 * @type {boolean}
 * @const
 */
spf.net.resourcebeta.IS_IE = spf.string.contains(
    navigator.userAgent, ' Trident/');


/**
 * The status of a resource.
 * @enum {number}
 */
spf.net.resourcebeta.Status = {
  LOADING: 1,
  LOADED: 2
};


/**
 * Supported resource types.
 * @enum {string}
 */
spf.net.resourcebeta.Type = {
  CSS: 'css',
  JS: 'js'
};
