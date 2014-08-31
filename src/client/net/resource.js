// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for loading and unloading external resources such
 * as scripts and styles.
 * See {@link spf.net.script} and {@link spf.net.style}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.resource');
goog.provide('spf.net.resource.status');
goog.provide('spf.net.resource.urls');

goog.require('spf');
goog.require('spf.array');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tasks');
goog.require('spf.tracing');
goog.require('spf.url');



/**
 * Loads resources asynchronously and optionally defines a name to use for
 * dependency management and unloading.  See {@link #unload} to remove
 * previously loaded resources.
 *
 * NOTE: Automatic unloading of styles depends on "onload" support and is
 * best effort.  Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 are supported.
 *
 * @param {spf.net.resource.Type} type Type of the resources.
 * @param {string|Array.<string>} urls One or more URLs of resources to load.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the resources
 *     or callback function to execute when the resources are loaded.
 * @param {Function=} opt_fn Optional callback function to execute when the
 *     resources are loaded.
 */
spf.net.resource.load = function(type, urls, opt_nameOrFn, opt_fn) {
  var isJS = type == spf.net.resource.Type.JS;

  // Convert to an array if needed.
  urls = spf.array.toArray(urls);
  // Determine if a name was provided with 3 or 4 arguments.
  var withName = spf.string.isString(opt_nameOrFn);
  var name = /** @type {string} */ (withName ? opt_nameOrFn : '');
  var fn = /** @type {Function|undefined} */ (withName ? opt_fn : opt_nameOrFn);
  spf.debug.debug('resource.load', type, urls, name);

  var canonicalize = spf.bind(spf.net.resource.canonicalize, null, type);
  urls = spf.array.map(urls, canonicalize);

  // After the styles are loaded, execute the callback by default.
  var done = fn;

  // If a name is provided with different URLs, then also unload the previous
  // versions after the resources are loaded.
  //
  // NOTE: When built for the bootloader, automatic unloading of scripts is not
  // supported.  If someone is attempting to load a new version of a script
  // before loading the main SPF code, then this should be an error.  Automatic
  // unloading of scripts is primarily intended for navigation between versions.
  if (name && !SPF_BOOTLOADER) {
    var loaded = spf.bind(spf.net.resource.status.loaded, null, type);
    var complete = spf.array.every(urls, loaded);
    var previous = spf.net.resource.urls.get(type, name);
    // If loading new resources for a name, handle unloading previous ones.
    if (!complete && previous) {
      var evt = isJS ? spf.EventName.JS_BEFORE_UNLOAD :
                       spf.EventName.CSS_BEFORE_UNLOAD;
      spf.dispatch(evt, {'name': name, 'urls': previous});
      spf.net.resource.urls.clear(type, name);
      done = function() {
        spf.net.resource.unload_(type, name, previous);
        fn && fn();
      };
    }
  }

  var pseudonym = name || '^' + urls.sort().join('^');
  // Associate the resources with the name/pseudonym for unloading + callbacks.
  spf.net.resource.urls.set(type, pseudonym, urls);
  // Subscribe the callback to execute when all urls are loaded.
  var topic = spf.net.resource.prefix(type, pseudonym);
  spf.debug.debug('  subscribing', topic, done);
  spf.pubsub.subscribe(topic, done);
  // Start asynchronously loading all the resources.
  spf.array.each(urls, function(url) {
    // If a status exists, the resource is already loading or loaded.
    if (spf.net.resource.status.get(type, url)) {
      spf.net.resource.check(type);
    } else {
      var check = spf.bind(spf.net.resource.check, null, type);
      var el = spf.net.resource.create(type, url, check);
      if (el && name) {
        el.setAttribute('name', name);
      }
    }
  });
};


/**
 * Unloads resources identified by dependency name.  See {@link #load}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 */
spf.net.resource.unload = function(type, name) {
  spf.debug.warn('resource.unload', type, name);
  var urls = spf.net.resource.urls.get(type, name) || [];
  spf.net.resource.urls.clear(type, name);
  spf.net.resource.unload_(type, name, urls);
};


/**
 * See {@link #unload_}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @param {Array.<string>} urls The URLs.
 * @private
 */
spf.net.resource.unload_ = function(type, name, urls) {
  var isJS = type == spf.net.resource.Type.JS;
  if (urls.length) {
    spf.debug.debug('  > resource.unload', type, urls);
    var evt = isJS ? spf.EventName.JS_UNLOAD :
                     spf.EventName.CSS_UNLOAD;
    spf.dispatch(evt, {'name': name, 'urls': urls});
    spf.array.each(urls, function(url) {
      spf.net.resource.destroy(type, url);
    });
  }
};


/**
 * Executes any pending callbacks possible by checking if all pending
 * urls for a name have loaded.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 */
spf.net.resource.check = function(type) {
  spf.debug.debug('resource.check', type);
  var prefix = spf.net.resource.prefix(type, '');
  for (var topic in spf.pubsub.subscriptions) {
    if (topic.indexOf(prefix) == 0) {
      var names = topic.substring(prefix.length).split('|');
      var allLoaded = spf.bind(spf.net.resource.urls.loaded, null, type);
      var ready = spf.array.every(names, allLoaded);
      spf.debug.debug(' ', topic, '->', names, '=', ready);
      if (ready) {
        spf.debug.debug('  publishing', topic);
        // Because check evaluates the pubsub.subscriptions array to determine
        // if urls for names are loaded, there is a potential subscribe/publish
        // infinite loop:
        //     require_ -> load (subscribe) -> check (publish) ->
        //     load (subscribe) -> <loop forever> ...
        // To avoid this, use flush instead of publish + clear to ensure that
        // previously subscribed functions are removed before execution:
        //     require_ -> load (subscribe) -> check (flush) -> <no loop>
        spf.pubsub.flush(topic);
      }
    }
  }
};


/**
 * Adds a resource to the page by creating an element and appending it to
 * the document.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 * @param {Function=} opt_callback Callback for when the resource has loaded.
 * @param {Document=} opt_document Optional document to use.
 * @return {Element} The dynamically created element.
 */
spf.net.resource.create = function(type, url, opt_callback, opt_document) {
  spf.debug.debug('resource.create', type, url, 'loading');
  // When built for the bootloader, always assume JS is being loaded.
  var isJS = SPF_BOOTLOADER || type == spf.net.resource.Type.JS;
  url = spf.net.resource.canonicalize(type, url);
  spf.net.resource.status.set(type, url, spf.net.resource.State.LOADING);
  var tag = isJS ? 'script' : 'link';
  var doc = opt_document || document;
  var el = doc.createElement(tag);
  var next = function() {
    spf.debug.debug('resource.create', type, url, 'done');
    // Only update status if the resource has not been removed in the interim.
    if (spf.net.resource.status.get(type, url)) {
      spf.debug.debug('resource.create', type, url, 'loaded');
      spf.net.resource.status.set(type, url, spf.net.resource.State.LOADED);
    }
    if (el && el.parentNode && doc == document && !SPF_DEBUG) {
      // Remove scripts afterwards to avoid unnecessary increased DOM size.
      el.parentNode.removeChild(el);
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
  var label = spf.net.resource.label(url);
  el.className = spf.net.resource.prefix(type, label);
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
    // Use appendChild for CSS to preserve order.
    head.appendChild(el);
  }
  return el;
};


/**
 * Removes a resource by removing a previously created element that was
 * appended to the document.  See {@link #create}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 * @param {Document=} opt_document Optional document to use.
 */
spf.net.resource.destroy = function(type, url, opt_document) {
  url = spf.net.resource.canonicalize(type, url);
  var label = spf.net.resource.label(url);
  var cls = spf.net.resource.prefix(type, label);
  var els = spf.dom.query('.' + cls, opt_document);
  spf.array.each(els, function(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
  spf.net.resource.status.clear(type, url);
};


/**
 * Discovers existing resources in the document and registers them as loaded.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @return {Array.<Node>|NodeList} The newly found elements.
 */
spf.net.resource.discover = function(type) {
  spf.debug.debug('resource.discover', type);
  var isJS = type == spf.net.resource.Type.JS;
  var selector = isJS ? 'script[src]' : 'link[rel~="stylesheet"]';
  var els = [];
  spf.array.each(spf.dom.query(selector), function(el) {
    var url = isJS ? el.src : el.href;
    url = spf.net.resource.canonicalize(type, url);
    // Ignore if already loading or loaded.
    if (!spf.net.resource.status.get(type, url)) {
      spf.net.resource.status.set(type, url, spf.net.resource.State.LOADED);
      var label = spf.net.resource.label(url);
      var cls = spf.net.resource.prefix(type, label);
      spf.dom.classlist.add(el, cls);
      var name = el.getAttribute('name');
      if (name) {
        spf.net.resource.urls.set(type, name, [url]);
      }
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
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 */
spf.net.resource.prefetch = function(type, url) {
  if (!url) {
    return;
  }
  url = spf.net.resource.canonicalize(type, url);
  if (spf.net.resource.status.get(type, url)) {
    return;
  }
  var label = spf.net.resource.label(url);
  var id = spf.net.resource.prefix(type, label);
  var key = spf.net.resource.prefix(type, 'prefetch');
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
  var next = spf.bind(spf.net.resource.prefetch_, null, el, type, url, id);
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
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 * @param {string} id The computed unique id of the resource.
 * @private
 */
spf.net.resource.prefetch_ = function(el, type, url, id) {
  var isJS = type == spf.net.resource.Type.JS;
  var doc = el.contentWindow.document;
  if (isJS) {
    var fetchEl = doc.createElement('object');
    if (spf.net.resource.IS_IE) {
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
    var fetchEl = spf.net.resource.create(type, url, null, doc);
    fetchEl.id = id;
  }
};



/**
 * Evaluates resource text and defines a name to use for management.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} text The text of the resource.
 * @param {string} name Name to identify the resource.
 */
spf.net.resource.eval = function(type, text, name) {
  var isJS = type == spf.net.resource.Type.JS;
  var previous = spf.net.resource.urls.get(type, name);
  // Use a hashcode to identify the resource instead of a URL.
  var id = 'hash-' + spf.string.hashcode(text.replace(/\s/g, ''));
  spf.net.resource.urls.set(type, name, [id]);
  var complete = spf.net.resource.status.loaded(type, id);
  if (complete) {
    return;
  }
  var el = spf.net.resource.exec(type, text);
  if (!el) {
    return;
  }
  spf.net.resource.status.set(type, id, spf.net.resource.State.LOADED);
  if (el && (!isJS || SPF_DEBUG)) {
    // Script elements are removed after execution, so only modify attributes
    // if a style or in debug mode.
    var label = spf.net.resource.label(id);
    var cls = spf.net.resource.prefix(type, label);
    el.className = cls;
    el.setAttribute('name', name);
  }
  previous = previous && previous[0];
  if (previous) {
    spf.net.resource.destroy(type, previous);
  }
};


/**
 * Executes resource text by creating an element and appending it to
 * the document.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} text The text of the resource.
 * @return {Element} The dynamically created element.
 */
spf.net.resource.exec = function(type, text) {
  text = spf.string.trim(text);
  if (!text) {
    return null;
  }
  var isJS = type == spf.net.resource.Type.JS;
  var targetEl = document.getElementsByTagName('head')[0] || document.body;
  var el;
  if (isJS) {
    el = document.createElement('script');
    el.text = text;
    // Place the scripts in the head instead of the body to avoid errors
    // when called from the head in the first place.
    targetEl.appendChild(el);
    if (!SPF_DEBUG) {
      // Remove scripts afterwards to avoid unnecessary increased DOM size.
      targetEl.removeChild(el);
    }
  } else {
    el = document.createElement('style');
    // IE requires the style element to be in the document before accessing
    // the StyleSheet object.
    targetEl.appendChild(el);
    if ('styleSheet' in el) {
      el.styleSheet.cssText = text;
    } else {
      el.appendChild(document.createTextNode(text));
    }
  }
  return el;
};


/**
 * Sets the path prefix or replacement map to use when resolving relative URLs.
 * See {@link #canonicalize}.
 *
 * Note: The order in which replacements are made is not guaranteed.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string|Object.<string>} paths The paths.
 */
spf.net.resource.path = function(type, paths) {
  var key = /** @type {spf.state.Key} */ (
      spf.state.Key.RESOURCE_PATHS_PREFIX + type);
  spf.state.set(key, paths);
};


/**
 * Convert a resource URL to the "canonical" version in three steps:
 *   1: replacing path segments (see {@link #path})
 *   2: appending a file type extension
 *   3: converting to absolute (see {@link spf.url.absolute})
 * Absolute URLs (i.e. those that start with http://) are ignored for all
 * three steps.  Protocol-relative URLs (i.e. those that start with //)
 * are ignored for steps 1 and 2.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The initial url.
 * @return {string} The adjusted url.
 */
spf.net.resource.canonicalize = function(type, url) {
  var key = /** @type {spf.state.Key} */ (
      spf.state.Key.RESOURCE_PATHS_PREFIX + type);
  if (url) {
    var index = url.indexOf('//');
    if (index < 0) {
      // Relative URL: "//" not found.
      if (spf.string.startsWith(url, 'hash-')) {
        // Ignore hashcode IDs.
        return url;
      }
      var paths = spf.state.get(key) || '';
      if (spf.string.isString(paths)) {
        url = paths + url;
      } else {
        for (var p in paths) {
          url = url.replace(p, paths[p]);
        }
      }
      url = url.indexOf('.' + type) < 0 ? url + '.' + type : url;
      url = spf.url.absolute(url);
    } else if (index == 0) {
      // Protocol-Relative URL: "//" found at start.
      url = spf.url.absolute(url);
    }
  }
  return url;
};


/**
 * Prefix a label to avoid conflicts.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {?} label The label
 * @return {string} The prefixed label.
 */
spf.net.resource.prefix = function(type, label) {
  return type + '-' + label;
};


/**
 * Convert a URL to an internal "label" for use in identifying it.
 *
 * @param {?} url The resource URL.
 * @return {string} The label.
 */
spf.net.resource.label = function(url) {
  return url ? String(url).replace(/[^\w]/g, '') : '';
};


/**
 * Sets the loading status for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @param {spf.net.resource.State} status The loading status.
 */
spf.net.resource.status.set = function(type, url, status) {
  var key = spf.net.resource.prefix(type, url);
  spf.net.resource.status_[key] = status;
};


/**
 * Returns the loading status for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @return {spf.net.resource.State|undefined} The loading status.
 */
spf.net.resource.status.get = function(type, url) {
  var key = spf.net.resource.prefix(type, url);
  return spf.net.resource.status_[key];
};


/**
 * Clears the previously set loading status for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 */
spf.net.resource.status.clear = function(type, url) {
  var key = spf.net.resource.prefix(type, url);
  delete spf.net.resource.status_[key];
};


/**
 * Checks to see if the status for a resource URL is "loaded".
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 */
spf.net.resource.status.loaded = function(type, url) {
  var status = spf.net.resource.status.get(type, url);
  return status == spf.net.resource.State.LOADED;
};


/**
 * Sets the resource URLs for a dependency name.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @param {Array.<string>} urls The URLs.
 */
spf.net.resource.urls.set = function(type, name, urls) {
  var key = spf.net.resource.prefix(type, name);
  spf.net.resource.urls_[key] = urls;
};


/**
 * Returns the list of resource URLs currently set for a dependency name.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @return {Array.<string>} The URLs.
 */
spf.net.resource.urls.get = function(type, name) {
  var key = spf.net.resource.prefix(type, name);
  return spf.net.resource.urls_[key];
};


/**
 * Clears all the previously set resource URLs for a dependency name.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 */
spf.net.resource.urls.clear = function(type, name) {
  var key = spf.net.resource.prefix(type, name);
  delete spf.net.resource.urls_[key];
};


/**
 * Checks to see if all resource URLs for a dependency have been loaded.
 * Falsey dependency names (e.g. null or an empty string) are always "loaded".
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @return {boolean}
 */
spf.net.resource.urls.loaded = function(type, name) {
  var urls = spf.net.resource.urls.get(type, name);
  var loaded = spf.bind(spf.net.resource.status.loaded, null, type);
  return !name || (!!urls && spf.array.every(urls, loaded));
};


/**
 * Map a url to a resource status.
 * @type {!Object.<spf.net.resource.State>}
 * @private
 */
spf.net.resource.status_ = {};


/**
 * Map a dependency name to associated urls.
 * @type {!Object.<Array.<string>>}
 * @private
 */
spf.net.resource.urls_ = {};


/**
 * Whether the browser is Internet Explorer; valid for MSIE 8+ aka Trident 4+.
 * @type {boolean}
 * @const
 */
spf.net.resource.IS_IE = spf.string.contains(
    navigator.userAgent, ' Trident/');


/**
 * The loading state of a resource.
 * @enum {number}
 */
spf.net.resource.State = {
  LOADING: 1,
  LOADED: 2
};


/**
 * Supported resource types.
 * @enum {string}
 */
spf.net.resource.Type = {
  CSS: 'css',
  JS: 'js'
};


// Automatic initiazation for spf.net.resource.status_.
// When built for the bootloader, unconditionally set in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.RESOURCE_STATUS, spf.net.resource.status_);
} else {
  if (!spf.state.has(spf.state.Key.RESOURCE_STATUS)) {
    spf.state.set(spf.state.Key.RESOURCE_STATUS, spf.net.resource.status_);
  }
  spf.net.resource.status_ =
      /** @type {!Object.<spf.net.resource.State>} */ (
      spf.state.get(spf.state.Key.RESOURCE_STATUS));
}

// Automatic initiazation for spf.net.resource.urls_.
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.RESOURCE_URLS, spf.net.resource.urls_);
} else {
  if (!spf.state.has(spf.state.Key.RESOURCE_URLS)) {
    spf.state.set(spf.state.Key.RESOURCE_URLS, spf.net.resource.urls_);
  }
  spf.net.resource.urls_ = /** @type {!Object.<Array.<string>>} */ (
      spf.state.get(spf.state.Key.RESOURCE_URLS));
}


if (spf.tracing.ENABLED) {
  (function() {
    spf.net.resource.load = spf.tracing.instrument(
        spf.net.resource.load, 'spf.net.resource.load');
    spf.net.resource.unload = spf.tracing.instrument(
        spf.net.resource.unload, 'spf.net.resource.unload');
    spf.net.resource.unload_ = spf.tracing.instrument(
        spf.net.resource.unload_, 'spf.net.resource.unload_');
    spf.net.resource.check = spf.tracing.instrument(
        spf.net.resource.check, 'spf.net.resource.check');
    spf.net.resource.create = spf.tracing.instrument(
        spf.net.resource.create, 'spf.net.resource.create');
    spf.net.resource.destroy = spf.tracing.instrument(
        spf.net.resource.destroy, 'spf.net.resource.destroy');
    spf.net.resource.discover = spf.tracing.instrument(
        spf.net.resource.discover, 'spf.net.resource.discover');
    spf.net.resource.prefetch = spf.tracing.instrument(
        spf.net.resource.prefetch, 'spf.net.resource.prefetch');
    spf.net.resource.prefetch_ = spf.tracing.instrument(
        spf.net.resource.prefetch_, 'spf.net.resource.prefetch_');
    spf.net.resource.eval = spf.tracing.instrument(
        spf.net.resource.eval, 'spf.net.resource.eval');
    spf.net.resource.exec = spf.tracing.instrument(
        spf.net.resource.exec, 'spf.net.resource.exec');
    spf.net.resource.path = spf.tracing.instrument(
        spf.net.resource.path, 'spf.net.resource.path');
    spf.net.resource.canonicalize = spf.tracing.instrument(
        spf.net.resource.canonicalize, 'spf.net.resource.canonicalize');
    spf.net.resource.prefix = spf.tracing.instrument(
        spf.net.resource.prefix, 'spf.net.resource.prefix');
    spf.net.resource.label = spf.tracing.instrument(
        spf.net.resource.label, 'spf.net.resource.label');
    spf.net.resource.status.set = spf.tracing.instrument(
        spf.net.resource.status.set, 'spf.net.resource.status.set');
    spf.net.resource.status.get = spf.tracing.instrument(
        spf.net.resource.status.get, 'spf.net.resource.status.get');
    spf.net.resource.status.clear = spf.tracing.instrument(
        spf.net.resource.status.clear, 'spf.net.resource.status.clear');
    spf.net.resource.status.loaded = spf.tracing.instrument(
        spf.net.resource.status.loaded, 'spf.net.resource.status.loaded');
    spf.net.resource.urls.set = spf.tracing.instrument(
        spf.net.resource.urls.set, 'spf.net.resource.urls.set');
    spf.net.resource.urls.get = spf.tracing.instrument(
        spf.net.resource.urls.get, 'spf.net.resource.urls.get');
    spf.net.resource.urls.clear = spf.tracing.instrument(
        spf.net.resource.urls.clear, 'spf.net.resource.urls.clear');
    spf.net.resource.urls.loaded = spf.tracing.instrument(
        spf.net.resource.urls.loaded, 'spf.net.resource.urls.loaded');
  })();
}
