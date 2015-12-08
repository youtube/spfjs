// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for loading and unloading external resources such
 * as scripts and stylesheets.
 * See {@link spf.net.script} and {@link spf.net.style}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.resource');
goog.provide('spf.net.resource.name');
goog.provide('spf.net.resource.status');
goog.provide('spf.net.resource.url');

goog.require('spf');
goog.require('spf.array');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.pubsub');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tasks');
goog.require('spf.tracing');
goog.require('spf.url');



/**
 * Loads a resource asynchronously and optionally defines a name to use for
 * dependency management and unloading.  See {@link #unload} to remove
 * previously loaded resources.
 *
 * NOTE: Automatic unloading of stylesheets depends on "onload" support and is
 * best effort.  Chrome 19, Safari 6, Firefox 9, Opera and IE 5.5 are supported.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url URL of the resource to load.
 * @param {string} name Name to identify the resource.
 * @param {Function=} opt_fn Optional callback function to execute when the
 *     resource is loaded.
 */
spf.net.resource.load = function(type, url, name, opt_fn) {
  spf.debug.debug('resource.load', type, url, name);
  var isJS = type == spf.net.resource.Type.JS;

  url = spf.net.resource.canonicalize(type, url);

  // Calling load without a name or with an empty string for a name isn't
  // officially supported, but if it happens, use a pseudonym to allow the
  // the resource to load and fire the callback.
  var pseudonym = name || '^' + url;
  var topic = spf.net.resource.key(type, pseudonym);
  var prevUrl;

  // If a name is provided with a different URL, then also unload the previous
  // version after the resource is loaded.
  //
  // NOTE: When built for the bootloader, automatic unloading of scripts is not
  // supported.  If someone is attempting to load a new version of a script
  // before loading the main SPF code, then this should be an error.  Automatic
  // unloading of scripts is primarily intended for navigation between versions.
  if (name && !SPF_BOOTLOADER) {
    // If loading a new resource for a name, handle unloading the previous one.
    prevUrl = spf.net.resource.url.get(type, name);
    if (prevUrl && url != prevUrl) {
      var evt = isJS ? spf.EventName.JS_BEFORE_UNLOAD :
                       spf.EventName.CSS_BEFORE_UNLOAD;
      spf.dispatch(evt, {'name': name, 'url': prevUrl});
      spf.net.resource.unloadPrepare_(type, name, prevUrl);
      // Wait until the new resource has finished loading before destroying
      // the previous one to avoid flashes of unstyled content w/ CSS.
      var unloadComplete = spf.bind(spf.net.resource.unloadComplete_, null,
                                    type, name, prevUrl);
      spf.pubsub.subscribe(topic, unloadComplete);
    }
  }

  // Associate the name/pseudonym with the resource for tracking name changes.
  // Associate the resource with the name/pseudonym for unloading + callbacks.
  var prevName = spf.net.resource.name.get(type, url);
  if (prevName && pseudonym != prevName) {
    // If changing names for this resource, remove the existing
    // name-to-resource and resource-to-name mappings (which are re-set just
    // below), and then transfer any callbacks.
    spf.net.resource.url.clear(type, prevName);
    spf.net.resource.name.clear(type, url);
    var prevTopic = spf.net.resource.key(type, prevName);
    spf.pubsub.rename(prevTopic, topic);
  }
  spf.net.resource.name.set(type, url, pseudonym);
  spf.net.resource.url.set(type, pseudonym, url);

  // Subscribe the callback to execute when the url is loaded.
  spf.debug.debug('  subscribing callback', topic);
  spf.pubsub.subscribe(topic, opt_fn);
  var check = spf.bind(spf.net.resource.check, null, type);

  // If a status exists, the resource is already loading or loaded.
  // Otherwise, create the resource.
  if (spf.net.resource.status.get(type, url)) {
    if (prevName && pseudonym != prevName) {
      // If changing names for this resource and it's already loaded, find
      // it and update the name attribute to keep the DOM in sync.
      var el = spf.net.resource.find(type, url);
      if (el) {
        el.setAttribute('name', name || '');
      }
    }
    check();
  } else {
    // If prevUrl is defined and the type is CSS, the styleshet will be loaded
    // in-place. This works because previous elements aren't destroyed until
    // loading is complete.
    var el = spf.net.resource.create(type, url, check, undefined, undefined,
        prevUrl);
    if (el && name) {
      el.setAttribute('name', name);
    }
  }
};


/**
 * Unloads resources identified by dependency name.  See {@link #load}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 */
spf.net.resource.unload = function(type, name) {
  spf.debug.warn('resource.unload', type, name);
  var url = spf.net.resource.url.get(type, name);
  spf.net.resource.unloadPrepare_(type, name, url);
  spf.net.resource.unloadComplete_(type, name, url);
};


/**
 * See {@link #unload}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @param {string|undefined} url The URL.
 * @private
 */
spf.net.resource.unloadPrepare_ = function(type, name, url) {
  spf.debug.debug('  > resource.unloadPrepare_', type, url);
  // Clear the dependency name to URL mapping.
  spf.net.resource.url.clear(type, name);
  // Clear the URL to dependency name mapping.
  if (url) {
    spf.net.resource.name.clear(type, url);
  }
  var topic = spf.net.resource.key(type, name);
  spf.debug.debug('  clearing callbacks for', topic);
  // Clear any pending callbacks for the dependency name.
  spf.pubsub.clear(topic);
};


/**
 * See {@link #unload}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @param {string|undefined} url The URL.
 * @private
 */
spf.net.resource.unloadComplete_ = function(type, name, url) {
  var isJS = type == spf.net.resource.Type.JS;
  if (url) {
    spf.debug.debug('  > resource.unloadComplete_', type, url);
    var evt = isJS ? spf.EventName.JS_UNLOAD :
                     spf.EventName.CSS_UNLOAD;
    spf.dispatch(evt, {'name': name, 'url': url});
    spf.net.resource.destroy(type, url);
  }
};


/**
 * Executes any pending callbacks possible by checking if any URLs for names
 * of a given type have loaded.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 */
spf.net.resource.check = function(type) {
  spf.debug.debug('resource.check', type);
  var prefix = spf.net.resource.key(type, '');
  for (var topic in spf.pubsub.subscriptions) {
    if (topic.indexOf(prefix) == 0) {
      var names = topic.substring(prefix.length).split('|');
      var loaded = spf.bind(spf.net.resource.url.loaded, null, type);
      var ready = spf.array.every(names, loaded);
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
 * @param {string=} opt_statusGroup Optional group to use in status tracking.
 * @param {string=} opt_prevUrl Optional URL of the previous version of this
 *     resource. Used for stylesheets to load new versions in-place to prevent
*      changing the order of the cascade.
 * @return {Element} The dynamically created element.
 */
spf.net.resource.create = function(type, url, opt_callback, opt_document,
    opt_statusGroup, opt_prevUrl) {
  spf.debug.debug('resource.create', type, url, 'loading');
  // When built for the bootloader, always assume JS is being loaded.
  var isJS = SPF_BOOTLOADER || type == spf.net.resource.Type.JS;
  url = spf.net.resource.canonicalize(type, url);
  spf.net.resource.status.set(spf.net.resource.State.LOADING,
                              type, url, opt_statusGroup);
  var tag = isJS ? 'script' : 'link';
  var doc = opt_document || document;
  var el = doc.createElement(tag);
  var next = function() {
    spf.debug.debug('resource.create', type, url, 'done');
    // Only update status if the resource has not been removed in the interim.
    if (spf.net.resource.status.get(type, url, opt_statusGroup)) {
      spf.debug.debug('resource.create', type, url, 'loaded');
      spf.net.resource.status.set(spf.net.resource.State.LOADED,
                                  type, url, opt_statusGroup);
    }
    if (isJS && el && el.parentNode && doc == document && !SPF_DEBUG) {
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
  el.className = spf.net.resource.key(type, label);
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
  // Prefer placing resources in the head instead of the body to avoid errors
  // when called from the head in the first place.
  var targetEl = doc.getElementsByTagName('head')[0] || doc.body;
  if (isJS) {
    el.async = true;
    el.src = url;
    // Use insertBefore for JS to avoid IE execution errors.
    targetEl.insertBefore(el, targetEl.firstChild);
  } else {
    el.rel = 'stylesheet';
    el.href = url;
    // If this stylesheet already exists under a different URL,
    // reload it in-place to prevent changing the order of the cascade.
    // It is only reloaded it in-place if it already exists in the head,
    // otherwise the new element is appended.
    var prevEl = opt_prevUrl ?
        spf.net.resource.find(type, opt_prevUrl, targetEl) : null;
    if (prevEl) {
      targetEl.insertBefore(el, prevEl);
    } else {
      targetEl.appendChild(el);
    }
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
  var el = spf.net.resource.find(type, url, opt_document);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
  spf.net.resource.status.clear(type, url);
};


/**
 * Finds a previously created element.
 * See {@link #create}.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url URL of the resource.
 * @param {(Document|Element)=} opt_root Optional document or element to
 *     search in.
 * @return {!Node|undefined} The found element, or undefined if not found.
 */
spf.net.resource.find = function(type, url, opt_root) {
  var label = spf.net.resource.label(url);
  var cls = spf.net.resource.key(type, label);
  var selector = '.' + cls;
  var els = spf.dom.query(selector, opt_root);
  return els[0];
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
      spf.net.resource.status.set(spf.net.resource.State.LOADED, type, url);
      var label = spf.net.resource.label(url);
      var cls = spf.net.resource.key(type, label);
      spf.dom.classlist.add(el, cls);
      var name = el.getAttribute('name');
      if (name) {
        spf.net.resource.name.set(type, url, name);
        spf.net.resource.url.set(type, name, url);
      }
      els.push(el);
      spf.debug.debug('  found', url, cls, name);
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
 * @param {boolean=} opt_force Whether to force fetching the resource even if
 *     it has already been fetched before; useful for preconnect when the
 *     connection keep-alive is shorter than repeat attempt intervals.
 */
spf.net.resource.prefetch = function(type, url, opt_force) {
  if (!url) {
    return;
  }
  url = spf.net.resource.canonicalize(type, url);
  // Skip fetching if the element is already loaded on the page, unless
  // opt_force is specified.
  if (!opt_force && spf.net.resource.status.get(type, url)) {
    return;
  }
  // If opt_force is specified, tracking whether the element exists is unneeded,
  // and if prefetching an image (e.g. for URL preconnection), the standard DOM
  // logic is also unneeded.  In this case, use the simpler/faster Image object.
  if (opt_force && type == spf.net.resource.Type.IMG) {
    spf.net.resource.preconnect_(url);
    return;
  }
  var label = spf.net.resource.label(url);
  var id = spf.net.resource.key(type, label);
  var key = spf.net.resource.key(type, 'prefetch');
  var el = /** @type {HTMLIFrameElement} */ (document.getElementById(key));
  if (!el) {
    el = spf.dom.createIframe(key, null, function(el) {
      // Use the title attribute as the iframe's loaded flag.
      el.title = key;
      spf.tasks.run(key, true);
    });
  } else {
    // Return if the resource is already prefetched, unless opt_force is
    // specified.
    if (!opt_force && el.contentWindow.document.getElementById(id)) {
      return;
    }
  }
  // Firefox needs the iframe to be fully created in the DOM before continuing.
  // So delay adding elements to the iframe until onload.
  var next = spf.bind(spf.net.resource.prefetch_, null, el, type, url, id, key);
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
 * @param {string} group The group value to use when tracking these resources.
 * @private
 */
spf.net.resource.prefetch_ = function(el, type, url, id, group) {
  var isJS = type == spf.net.resource.Type.JS;
  var isCSS = type == spf.net.resource.Type.CSS;
  var doc = el.contentWindow.document;
  // If an element with a given id already exists, remove it before prefetching
  // the resource to avoid growing the overall DOM size.  Since `prefetch`
  // already checks for the element's existence before calling this method,
  // this is to prevent repeated calls with `opt_force` from always generating
  // new nodes.
  var fetchEl = doc.getElementById(id);
  if (fetchEl) {
    fetchEl.parentNode.removeChild(fetchEl);
  }
  if (isJS) {
    fetchEl = doc.createElement('object');
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
  } else if (isCSS) {
    // Stylesheets can be prefetched in the same way as loaded.
    fetchEl = spf.net.resource.create(type, url, null, doc, group);
    fetchEl.id = id;
  } else {
    // For establishing a preconnection, use an image request.
    fetchEl = doc.createElement('img');
    if (spf.net.resource.IS_IE) {
      // IE needs page-level cache busting to properly re-request images, but
      // not network-level.  Use URL hashes to trick it into re-sending.
      url = url + '#' + spf.now();
    }
    fetchEl.src = url;
    fetchEl.id = id;
    doc.body.appendChild(fetchEl);
  }
};


/**
 * See {@link #prefetch}.
 *
 * @param {string} url URL of the resource.
 * @private
 */
spf.net.resource.preconnect_ = function(url) {
  // For establishing a preconnection, use an image request.  When the DOM logic
  // is not needed to track status, use the simpler/faster object approach.
  var img = new Image();
  if (spf.net.resource.IS_IE) {
    // IE needs page-level cache busting to properly re-request images, but
    // not network-level.  Use URL hashes to trick it into re-sending.
    url = url + '#' + spf.now();
  }
  img.src = url;
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
  var previous = spf.net.resource.url.get(type, name);
  // Use a hashcode to identify the resource instead of a URL.
  var id = 'hash-' + spf.string.hashcode(text.replace(/\s/g, ''));
  spf.net.resource.url.set(type, name, id);
  var complete = spf.net.resource.status.loaded(type, id);
  if (complete) {
    return;
  }
  var el = spf.net.resource.exec(type, text);
  if (!el) {
    return;
  }
  spf.net.resource.status.set(spf.net.resource.State.LOADED, type, id);
  if (el && (!isJS || SPF_DEBUG)) {
    // Script elements are removed after execution, so only modify attributes
    // if a style or in debug mode.
    var label = spf.net.resource.label(id);
    var cls = spf.net.resource.key(type, label);
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
      // Images don't have a standard extension format.
      if (type != spf.net.resource.Type.IMG) {
        url = url.indexOf('.' + type) < 0 ? url + '.' + type : url;
      }
      url = spf.url.absolute(url);
    } else if (index == 0) {
      // Protocol-Relative URL: "//" found at start.
      url = spf.url.absolute(url);
    }
  }
  return url;
};


/**
 * Build the full resource key.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} label The resource label.
 * @param {string=} opt_group An optional group name for the resource.
 * @return {string} The compound key.
 */
spf.net.resource.key = function(type, label, opt_group) {
  return type + '-' + label + (opt_group ? '-' + opt_group : '');
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
 * @param {spf.net.resource.State} status The loading status.
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @param {string=} opt_group Optional group.
 */
spf.net.resource.status.set = function(status, type, url, opt_group) {
  var key = spf.net.resource.key(type, url, opt_group);
  spf.net.resource.status_[key] = status;
};


/**
 * Returns the loading status for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @param {string=} opt_group Optional group.
 * @return {spf.net.resource.State|undefined} The loading status.
 */
spf.net.resource.status.get = function(type, url, opt_group) {
  var key = spf.net.resource.key(type, url, opt_group);
  return spf.net.resource.status_[key];
};


/**
 * Clears the previously set loading status for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 */
spf.net.resource.status.clear = function(type, url) {
  var key = spf.net.resource.key(type, url);
  delete spf.net.resource.status_[key];
};


/**
 * Checks to see if the status for a resource URL is "loaded".
 * URLs that are empty strings are always "loaded".
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @return {boolean} Whether the URL is loaded.
 */
spf.net.resource.status.loaded = function(type, url) {
  var status = spf.net.resource.status.get(type, url);
  return url == '' || status == spf.net.resource.State.LOADED;
};


/**
 * Sets the dependency name for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @param {string} name The dependency name.
 */
spf.net.resource.name.set = function(type, url, name) {
  var key = spf.net.resource.key(type, url);
  spf.net.resource.name_[key] = name;
};


/**
 * Returns the dependency name currently set for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 * @return {string|undefined} The dependency name.
 */
spf.net.resource.name.get = function(type, url) {
  var key = spf.net.resource.key(type, url);
  return spf.net.resource.name_[key];
};


/**
 * Clears the previously set dependency name for a resource URL.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} url The URL.
 */
spf.net.resource.name.clear = function(type, url) {
  var key = spf.net.resource.key(type, url);
  delete spf.net.resource.name_[key];
};


/**
 * Sets the resource URL for a dependency name.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @param {string} url The URL.
 */
spf.net.resource.url.set = function(type, name, url) {
  var key = spf.net.resource.key(type, name);
  spf.net.resource.url_[key] = url;
};


/**
 * Returns the resource URL currently set for a dependency name.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @return {string|undefined} The URL.
 */
spf.net.resource.url.get = function(type, name) {
  var key = spf.net.resource.key(type, name);
  var url = spf.net.resource.url_[key];
  return url;
};


/**
 * Clears the previously set resource URL for a dependency name.
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 */
spf.net.resource.url.clear = function(type, name) {
  var key = spf.net.resource.key(type, name);
  delete spf.net.resource.url_[key];
};


/**
 * Checks to see if the resource URL for a dependency name has been loaded.
 * Dependency names that are empty strings are always "loaded".
 *
 * @param {spf.net.resource.Type} type Type of the resource.
 * @param {string} name The dependency name.
 * @return {boolean}
 */
spf.net.resource.url.loaded = function(type, name) {
  var url = spf.net.resource.url.get(type, name);
  return url != undefined && spf.net.resource.status.loaded(type, url);
};


/**
 * Map a URL to a resource status.
 * @type {!Object.<spf.net.resource.State>}
 * @private
 */
spf.net.resource.status_ = {};


/**
 * Map a URL to a dependency name.
 * @type {!Object.<string>}
 * @private
 */
spf.net.resource.name_ = {};


/**
 * Map a dependency name to a URL.
 * @type {!Object.<string>}
 * @private
 */
spf.net.resource.url_ = {};


/**
 * Whether the browser is Internet Explorer; valid for MSIE 8+ aka Trident 4+.
 * @type {boolean}
 * @const
 */
spf.net.resource.IS_IE = spf.string.contains(navigator.userAgent, ' Trident/');


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
  IMG: 'img',
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

// Automatic initiazation for spf.net.resource.name_.
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.RESOURCE_NAME, spf.net.resource.name_);
} else {
  if (!spf.state.has(spf.state.Key.RESOURCE_NAME)) {
    spf.state.set(spf.state.Key.RESOURCE_NAME, spf.net.resource.name_);
  }
  spf.net.resource.name_ = /** @type {!Object.<string>} */ (
      spf.state.get(spf.state.Key.RESOURCE_NAME));
}

// Automatic initiazation for spf.net.resource.url_.
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.RESOURCE_URL, spf.net.resource.url_);
} else {
  if (!spf.state.has(spf.state.Key.RESOURCE_URL)) {
    spf.state.set(spf.state.Key.RESOURCE_URL, spf.net.resource.url_);
  }
  spf.net.resource.url_ = /** @type {!Object.<string>} */ (
      spf.state.get(spf.state.Key.RESOURCE_URL));
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
    spf.net.resource.key = spf.tracing.instrument(
        spf.net.resource.key, 'spf.net.resource.key');
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
    spf.net.resource.url.set = spf.tracing.instrument(
        spf.net.resource.url.set, 'spf.net.resource.url.set');
    spf.net.resource.url.get = spf.tracing.instrument(
        spf.net.resource.url.get, 'spf.net.resource.url.get');
    spf.net.resource.url.clear = spf.tracing.instrument(
        spf.net.resource.url.clear, 'spf.net.resource.url.clear');
    spf.net.resource.url.loaded = spf.tracing.instrument(
        spf.net.resource.url.loaded, 'spf.net.resource.url.loaded');
  })();
}
