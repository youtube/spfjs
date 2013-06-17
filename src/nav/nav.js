/**
 * @fileoverview Functions to handle pushstate-based navigation.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


goog.provide('spf.nav');

goog.require('spf');
goog.require('spf.cache');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classes');
goog.require('spf.dom.url');
goog.require('spf.history');
goog.require('spf.net.scripts');
goog.require('spf.net.styles');
goog.require('spf.net.xhr');
goog.require('spf.pubsub');
goog.require('spf.string');


/**
 * Type definition for a SPF response object.
 * - css: HTML string containing <link> and <style> tags of CSS to install.
 * - html: Map of Element IDs to HTML strings containing content with which
 *      to update the Elements.
 * - attr: Map of Element IDs to maps of attibute names to attribute values
 *      to set on the Elements.
 * - js: HTML string containing <script> tags of JS to execute.
 * - title: String of the new Document title.
 * - timing: Map of timing attributes to timestamp numbers.
 * - redirect: String of a URL to request instead.
 *
 * @typedef {{
 *   css: (string|undefined),
 *   html: (Object.<string, string>|undefined),
 *   attr: (Object.<string, Object.<string, string>>|undefined),
 *   js: (string|undefined),
 *   title: (string|undefined),
 *   timing: (Object.<string, number>|undefined),
 *   redirect: (string|undefined)
 * }}
 */
spf.nav.Response;


/**
 * Initializes (enables) pushState navigation.
 */
spf.nav.init = function() {
  if (!spf.nav.initialized_) {
    document.addEventListener('click', spf.nav.handleClick, false);
    spf.nav.initialized_ = true;
  }
};


/**
 * Disposes (disables) pushState navigation.
 */
spf.nav.dispose = function() {
  if (spf.nav.initialized_) {
    document.removeEventListener('click', spf.nav.handleClick, false);
    spf.nav.initialized_ = false;
  }
};


/**
 * Handles page clicks on SPF links and adds pushState history entries for them.
 *
 * @param {Event} evt The click event.
 */
spf.nav.handleClick = function(evt) {
  spf.debug.debug('nav.handleClick ', 'evt=', evt);
  // Ignore clicks with modifier keys.
  if (evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey) {
    spf.debug.debug('    ignoring click with modifier key');
    return;
  }
  // Ignore clicks with alternate buttons (left = 0, middle = 1, right = 2).
  if (evt.button > 0) {
    spf.debug.debug('    ignoring click with alternate button');
    return;
  }
  // Ignore clicks on targets without the link class or not within
  // a container with the link class.
  var linkEl = spf.dom.getAncestor(evt.target, function(node) {
    return spf.dom.classes.has(node, spf.config['link-class']);
  });
  if (!linkEl) {
    spf.debug.debug('    ignoring click without link class');
    return;
  }
  // Ignore clicks on targets with the nolink class or within
  // a container with the nolink class.
  if (spf.config['nolink-class']) {
    var nolinkEl = spf.dom.getAncestor(evt.target, function(node) {
      return spf.dom.classes.has(node, spf.config['nolink-class']);
    });
    if (nolinkEl) {
      spf.debug.debug('    ignoring click with nolink class');
      return;
    }
  }
  // Adjust the target element to be the one with an href.
  var target = spf.dom.getAncestor(evt.target, function(node) {
    return node.href;
  }, linkEl);
  // Ignore clicks on targets without an href.
  if (!target) {
    spf.debug.debug('    ignoring click without href');
    return;
  }
  // Ignore clicks to the same page or to empty URLs.
  var url = target.href;
  if (!url || url == window.location.href) {
    spf.debug.debug('    ignoring click to same page');
    // Prevent the default browser navigation to avoid hard refreshes.
    evt.preventDefault();
    return;
  }
  // Navigate to the URL.
  spf.nav.navigate_(url);
  // Prevent the default browser navigation to avoid hard refreshes.
  evt.preventDefault();
};


/**
 * Handles when the active history entry changes.
 *
 * @param {string} url The URL the user is browsing to.
 * @param {Object=} opt_state An optional state object associated with the URL.
 */
spf.nav.handleHistory = function(url, opt_state) {
  var reverse = !!(opt_state && opt_state['spf-back']);
  var referer = opt_state && opt_state['spf-referer'];
  spf.debug.debug('nav.handleHistory ', 'url=', url, 'state=', opt_state);
  // Navigate to the URL.
  spf.nav.navigate_(url, referer, true, reverse);
};


/**
 * Navigates to a URL using the SPF protocol.  A pushState history entry is
 * added for the URL, and if successful, the navigation is performed.  If not,
 * the browser is redirected to the URL.
 *
 * During the navigation, first the content is requested by {@link #request}.
 * If the reponse is sucessfully parsed, it is processed by {@link #process}.
 * If not, the browser is redirected to the URL. Only a single navigation
 * request can be in flight at once.  If a second URL is navigated to while a
 * first is still pending, the first will be cancelled.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 */
spf.nav.navigate = function(url) {
  // Ignore navigation to the same page or to an empty URL.
  if (!url || url == window.location.href) {
    return;
  }
  // Navigate to the URL.
  spf.nav.navigate_(url);
};


/**
 * Performs navigation to a URL.
 * See {@link #navigate}, {@link #handleClick}, and {@link #handleHistory}.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {string=} opt_referer The Referrer URL, without the SPF identifier.
 *     Defaults to the current URL.
 * @param {boolean=} opt_history Whether this navigation is part of a history
 *     change. True when navigation is in response to a popState event.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @private.
 */
spf.nav.navigate_ = function(url, opt_referer, opt_history, opt_reverse) {
  spf.debug.info('nav.navigate ', url, opt_referer, opt_history, opt_reverse);
  // If navigation is requested but SPF is not initialized, redirect.
  if (!spf.nav.initialized_) {
    spf.debug.error('nav not initialized, redirecting ',
                    'url=', url);
    window.location.href = url;
    return;
  }
  // Abort previous navigation, if needed.
  if (spf.nav.request_) {
    spf.debug.warn('aborting previous navigate ',
                   'xhr=', spf.nav.request_);
    spf.nav.request_.abort();
    spf.nav.request_ = null;
  }
  // Set the navigation referer, stored in the history entry state object
  // to allow the correct value to be sent to the server during back/forward.
  // Only different than the current URL when navigation is in response to
  // a popState event.
  var referer = opt_referer || window.location.href;
  // Publish to callbacks.
  // Do this before the request is made, since the response might be cached,
  // in which case the operation is synchronous.
  // Use a try/catch to prevent errors in client code from blocking navigation.
  try {
    spf.pubsub.publish('navigate-requested-callback', url);
  } catch (err) {
    spf.debug.error('error in "navigate-requested-callback", redirecting ',
                    'url=', url, 'err=', err);
    window.location.href = url;
    return;
  }
  var navigateError = function(url) {
    spf.debug.warn('navigate failed, redirecting ',
                   'url=', url);
    spf.nav.request_ = null;
    window.location.href = url;
    return;
  };
  var navigateSuccess = function(url, response) {
    spf.nav.request_ = null;
    // Check for redirects.
    if (response['redirect']) {
      // If a redirect is issued in response to a new navigation,
      // navigate to the redirect URL directly.
      var redirectUrl = response['redirect'];
      if (!opt_history) {
        spf.nav.navigate_(redirectUrl, referer, opt_history, opt_reverse);
      } else {
        // Otherwise, replace the current history entry with the redirect,
        // executing the callback to trigger the next navigation.
        var state = {'spf-referer': referer};
        spf.history.replace(redirectUrl, state, true);
      }
      return;
    }
    // Check for new navigation that needs a history entry added.
    if (!opt_history) {
      try {
        // Add the URL to the history stack.
        var state = {'spf-referer': referer};
        spf.history.add(url, state);
      } catch (err) {
        // An error is thrown if the state object is too large or if the
        // URL is not in the same domain.  At this point the XHR has succeeded,
        // so the same domain error should not occur, and browser limits
        // on the serialized state objects should be much larger than the
        // data used by SPF.  However, in case external JS has modified the
        // state object or a unforeseen mismatch in security policies between
        // XHR and History occurs, handle the error here and redirect.
        spf.debug.error('error caught, redirecting ',
                        'url=', url, 'err=', err);
        window.location.href = url;
        return;
      }
    }
    // Process the requested response.
    spf.nav.process(response, opt_reverse, 'navigate-processed-callback');
  };
  var xhr = spf.nav.request(url, navigateSuccess, navigateError,
                            'navigate-received-callback', 'navigate',
                            referer);
  spf.nav.request_ = xhr;
};


/**
 * Loads a URL using the SPF protocol.  Similar to {@link #navigate}, but
 * intended for traditional content updates, not page navigation.  Not subject
 * to restrictions on the number of simultaneous requests.  The content is
 * requested by {@link #request}.  If the response is successfully parsed, it
 * is processed by {@link #process}, and the URL and response object are passed
 * to the optional {@code opt_onSuccess} callback.  If not, the URL is passed
 * to the optional {@code opt_onError} callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the load succeeds.
 * @param {function(string)=} opt_onError The callback to execute if the
 *     load fails.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.load = function(url, opt_onSuccess, opt_onError) {
  spf.debug.info('nav.load ', url);
  var loadError = function(url) {
    spf.debug.warn('load failed ', 'url=', url);
    if (opt_onError) {
      opt_onError(url);
    }
  };
  var loadSuccess = function(url, response) {
    // Check for redirects.
    if (response['redirect']) {
      spf.nav.load(response['redirect'], opt_onSuccess, opt_onError);
      return;
    }
    // Process the requested response.
    spf.nav.process(response);
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  return spf.nav.request(url, loadSuccess, loadError, null, 'load');
};


/**
 * Requests a URL using the SPF protocol and parses the response.  If
 * successful, the URL and response object are passed to the optional
 * {@code opt_onSuccess} callback.  If not, the URL is passed to the optional
 * {@code opt_onError} callback.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the request succeeds.
 * @param {function(string)=} opt_onError The callback to execute if the
 *     request fails.
 * @param {?string=} opt_notification The notification to publish if the
 *     request succeeds.
 * @param {?string=} opt_type The type of request (e.g. "navigate", "load",
 *     etc), used to alter the URL identifier; defaults to "request".
 * @param {string=} opt_referer The Referrer URL, without the SPF identifier.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.request = function(url, opt_onSuccess, opt_onError, opt_notification,
                           opt_type, opt_referer) {
  spf.debug.debug('nav.request ', url);
  // Convert the URL to absolute, to be used for caching the response.
  var absoluteUrl = spf.dom.url.absolute(url);
  spf.debug.debug('    absolute url ', absoluteUrl);
  // Add the SPF identifier, to be used for sending the request.
  var requestUrl = absoluteUrl;
  var ident = spf.config['url-identifier'] || '';
  if (ident) {
    ident = ident.replace('__type__', opt_type || 'request');
    if (spf.string.startsWith(ident, '?') &&
        spf.string.contains(requestUrl, '?')) {
      requestUrl += ident.replace('?', '&');
    } else {
      requestUrl += ident;
    }
  }
  spf.debug.debug('    identified url ', requestUrl);
  // Record a start time before sending the request or loading from cache.
  // This will be recored later as navigationStart.
  var start = spf.now();
  var timing = {};
  var requestResponse = function(xhr) {
    spf.debug.debug('    XHR response', 'status=', xhr.status, 'xhr=', xhr);
    // Record the timing information.
    timing['navigationStart'] = start;
    if (xhr['timing']) {
      for (var t in xhr['timing']) {
        timing[t] = xhr['timing'][t];
      }
    }
    // Attempt to parse the response.
    try {
      if ('JSON' in window) {
        var response = JSON.parse(xhr.responseText);
      } else {
        var response = eval('(' + xhr.responseText + ')');
      }
    } catch (err) {
      spf.debug.debug('    JSON parse failed');
      if (opt_onError) {
        opt_onError(url);
      }
      return;
    }
    response = /** @type {spf.nav.Response} */ (response);
    // Cache the response for future requests.
    // Use the absolute URL without identifier to allow cached responses
    // from prefetching to apply to navigation.
    spf.cache.set(absoluteUrl, response, spf.config['cache-lifetime']);
    // Set the timing values for the response.
    response['timing'] = timing;
    if (opt_notification) {
      // Publish to callbacks.
      // Use a try/catch to prevent errors in client code from blocking
      // navigation.
      try {
        spf.pubsub.publish(opt_notification, url, response);
      } catch (err) {
        spf.debug.error('error in "' + opt_notification + '", redirecting ',
                        'url=', url, 'err=', err);
        window.location.href = url;
        return;
      }
    }
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  // Try to find a cached response for the request before sending a new XHR.
  // Record fetchStart time before loading from cache.
  timing['fetchStart'] = spf.now()
  // Use the absolute URL without identifier to allow cached responses
  // from prefetching to apply to navigation.
  var cachedResponse = spf.cache.get(absoluteUrl);
  if (cachedResponse) {
    cachedResponse = /** @type {spf.nav.Response} */ (cachedResponse);
    // Record responseStart and responseEnd times after loading from cache.
    timing['responseStart'] = timing['responseEnd'] = spf.now();
    timing['navigationStart'] = start;
    // Store the timing for the cached response (avoid stale timing values).
    cachedResponse['timing'] = timing;
    spf.debug.debug('    cached response found ', cachedResponse);
    if (opt_notification) {
      // Publish to callbacks.
      // Use a try/catch to prevent errors in client code from blocking
      // navigation.
      try {
        spf.pubsub.publish(opt_notification, url, cachedResponse);
      } catch (err) {
        spf.debug.error('error in "' + opt_notification + '", redirecting ',
                        'url=', url, 'err=', err);
        window.location.href = url;
        return;
      }
    }
    if (opt_onSuccess) {
      opt_onSuccess(url, cachedResponse);
    }
  } else {
    spf.debug.debug('    sending XHR');
    // If no cached response is found, reset the timing data to use
    // the values provided by the XHR instead.
    timing = {};
    var headers;
    if (opt_referer) {
      headers = {'X-SPF-Referer': opt_referer};
    }
    var xhr = spf.net.xhr.get(requestUrl, {
      headers: headers,
      timeoutMs: spf.config['request-timeout'],
      onSuccess: requestResponse,
      onError: requestResponse,
      onTimeout: requestResponse
    });
    return xhr;
  }
};


/**
 * Process the response using the SPF protocol.  The response object should
 * already have been unserialized by {@link #request}.
 *
 * @param {spf.nav.Response} response The SPF response object to process.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 * @param {string=} opt_notification The notification to publish if the
 *     request succeeds.
 */
spf.nav.process = function(response, opt_reverse, opt_notification) {
  spf.debug.info('nav.process ', response, opt_reverse);
  // Install page styles.
  var result = spf.net.styles.parse(response['css']);
  spf.net.styles.install(result);
  spf.debug.debug('    installed styles');
  // Update title.
  if (response['title']) {
    document.title = response['title'];
  }
  // Update attributes.
  var attributes = response['attr'] || {};
  for (var id in attributes) {
    var el = document.getElementById(id);
    if (!el) {
      continue;
    }
    spf.dom.setAttributes(el, attributes[id]);
    spf.debug.debug('    set attributes ', id);
  }
  // Tally the number of content updates need.
  var remaining = 0;
  var fragments = response['html'] || {};
  if (Object.keys) {
    remaining = Object.keys(fragments).length;
  } else {
    for (var id in fragments) {
      remaining++;
    }
  }
  // Set up to execute scripts after the content loads.
  var maybeContinueAfterContent = function() {
    // Only execute when remaining is 0, to avoid early execution.
    if (remaining == 0) {
      // Execute scripts.
      result = spf.net.scripts.parse(response['js']);
      spf.net.scripts.execute(result, function() {
        spf.debug.debug('    executed scripts');
        if (opt_notification) {
          // Publish to callbacks.
          // Use a try/catch to prevent errors in client code from blocking
          // navigation.
          try {
            spf.pubsub.publish(opt_notification, response);
          } catch (err) {
            spf.debug.error('error in "' + opt_notification + '", ignoring ',
                            'err=', err);
          }
        }
      });
      // Prevent double execution.
      remaining--;
    }
  };
  // Update content.
  for (var id in fragments) {
    var el = document.getElementById(id);
    if (!el) {
      remaining--;
      continue;
    }
    var html = fragments[id];
    var key = spf.getKey(el);
    if (!spf.nav.animate_ ||
        !spf.dom.classes.has(el, spf.config['transition-class'])) {
      result = spf.net.scripts.parse(html);
      // If the target element isn't enabled for transitions, just replace.
      // Use the parsed HTML without script tags to avoid any scripts
      // being accidentally considered loading.
      el.innerHTML = result.parsed;
      spf.debug.debug('    updated fragment content ', id);
      // Execute embedded scripts before continuing.
      spf.net.scripts.execute(result, function() {
        spf.debug.debug('    executed fragment scripts ', id);
        remaining--;
        maybeContinueAfterContent();
      });
    } else {
      // Otherwise, check for a previous transition before continuing.
      spf.nav.process_(key, true);
      // Define variables used throughout the transition steps.
      var queue = [];
      var data = {
        reverse: !!opt_reverse,
        result: spf.net.scripts.parse(html),
        currentEl: null,  // Set in Step 1.
        pendingEl: null,  // Set in Step 1.
        parentEl: el,
        currentClass: spf.config['transition-current-child-class'],
        pendingClass: !!opt_reverse ?
                          spf.config['transition-reverse-child-class'] :
                          spf.config['transition-forward-child-class'],
        parentClass: !!opt_reverse ?
                         spf.config['transition-reverse-parent-class'] :
                         spf.config['transition-forward-parent-class']
      };
      // Transition Step 1: Insert new (timeout = 0).
      queue.push([function(data, next) {
        // Reparent the existing elements.
        data.currentEl = document.createElement('div');
        data.currentEl.className = data.currentClass;
        spf.dom.inflateElement(data.parentEl, data.currentEl);
        // Add the new content.
        data.pendingEl = document.createElement('div');
        data.pendingEl.className = data.pendingClass;
        // Use the parsed HTML without script tags to avoid any scripts
        // being accidentally considered loading.
        data.pendingEl.innerHTML = data.result.parsed;
        if (data.reverse) {
          spf.dom.insertSiblingBefore(data.pendingEl, data.currentEl);
        } else {
          spf.dom.insertSiblingAfter(data.pendingEl, data.currentEl);
        }
        next();
      }, 0]);
      // Transition Step 2: Switch between old and new (timeout = 0).
      queue.push([function(data, next) {
        spf.dom.classes.add(data.parentEl, data.parentClass);
        next();
      }, 0]);
      // Transition Step 3: Remove old (timeout = config duration).
      queue.push([function(data, next) {
        spf.debug.debug('    updated fragment content ', data.parentEl.id);
        // When done, remove the old content.
        data.parentEl.removeChild(data.currentEl);
        // End the transition.
        spf.dom.classes.remove(data.parentEl, data.parentClass);
        // Reparent the new elements.
        spf.dom.flattenElement(data.pendingEl);
        next();
      }, spf.config['transition-duration']]);
      // Transition Step 4: Execute scripts (timeout = 0).
      queue.push([function(data, next) {
        // Execute embedded scripts before continuing.
        spf.net.scripts.execute(data.result, function() {
          spf.debug.debug('    executed fragment scripts ', data.parentEl.id);
          remaining--;
          maybeContinueAfterContent();
          next();
        });
      }, 0]);
      // Store the steps so the transition can be cleared, if needed.
      spf.nav.transitions_[key] = {timer: 0, queue: queue, data: data};
      // Execute the steps in order.
      spf.nav.process_(key);
    }
  }
  // Attempt to continue, in case no content is returned.
  maybeContinueAfterContent();
};


/**
 * See {@link #process}.
 *
 * @param {string} key The transition key.
 * @private
 */
spf.nav.process_ = function(key, opt_quick) {
  var transitions = spf.nav.transitions_;
  if (key in transitions) {
    if (transitions[key].queue.length > 0) {
      var step = transitions[key].queue.shift();
      if (opt_quick) {
        step[0](transitions[key].data, function() {
          spf.nav.process_(key, opt_quick);
        });
      } else {
        transitions[key].timer = setTimeout(function() {
          step[0](transitions[key].data, function() {
            spf.nav.process_(key, opt_quick);
          });
        }, step[1]);
      }
    } else {
      clearTimeout(transitions[key].timer)
      delete transitions[key];
    }
  }
};


/**
 * Prefetches a URL using the SPF protocol.  Use to prime the SPF request cache
 * with the content and the browser cache with script and stylesheet URLs.
 * The content is requested by {@link #request}.  If the response is
 * successfully parsed, it is processed by {@link #preprocess}, and the URL and
 * response object are passed to the optional {@code opt_onSuccess} callback.
 * If not, the URL is passed to the optional {@code opt_onError} callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the load succeeds.
 * @param {function(string)=} opt_onError The callback to execute if the
 *     load fails.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.prefetch = function(url, opt_onSuccess, opt_onError) {
  spf.debug.info('nav.prefetch ', url);
  var fetchError = function(url) {
    spf.debug.warn('prefetch failed ', 'url=', url);
    if (opt_onError) {
      opt_onError(url);
    }
  };
  var fetchSuccess = function(url, response) {
    // Check for redirects.
    if (response['redirect']) {
      spf.nav.prefetch(response['redirect'], opt_onSuccess, opt_onError);
      return;
    }
    // Preprocess the requested response.
    spf.nav.preprocess(response);
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  return spf.nav.request(url, fetchSuccess, fetchError, null, 'prefetch');
};


/**
 * Preprocesses the response using the SPF protocol.  The response object
 * should already have been unserialized by {@link #request}.  Similar to
 * {@link #process} but instead of page content being updated, script and
 * stylesheet URLs are prefetched.
 *
 * @param {spf.nav.Response} response The SPF response object to preprocess.
 */
spf.nav.preprocess = function(response) {
  spf.debug.info('nav.preprocess ', response);
  // Preinstall page styles.
  var result = spf.net.styles.parse(response['css']);
  spf.net.styles.preinstall(result);
  spf.debug.debug('    preinstalled styles');
  // Preexecute fragment scripts.
  var fragments = response['html'] || {};
  for (var id in fragments) {
    result = spf.net.scripts.parse(fragments[id]);
    spf.net.scripts.preexecute(result);
    spf.debug.debug('    preexecuted fragment scripts ', id);
  }
  // Preexecute page scripts.
  result = spf.net.scripts.parse(response['js']);
  spf.net.scripts.preexecute(result);
  spf.debug.debug('    preexecuted scripts');
};


/**
 * @type {boolean}
 * @private
 */
spf.nav.initialized_ = false;


/**
 * @type {XMLHttpRequest}
 * @private
 */
spf.nav.request_;


/**
 * @type {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>}
 * @private
 */
spf.nav.transitions_ = {};


/**
 * Whether the browser supports animation via CSS Transitions.
 * @type {boolean}
 * @private
 */
spf.nav.animate_ = (function() {
  var testEl = document.createElement('div');
  var prefixes = ['Webkit', 'Moz', 'Ms', 'O', 'Khtml'];
  for (var i = 0, l = prefixes.length; i < l; i++) {
    if (prefixes[i] + 'Transition' in testEl.style) {
      return true;
    }
  }
  return false;
})();
