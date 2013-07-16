/**
 * @fileoverview Functions to handle pushstate-based navigation.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


goog.provide('spf.nav');

goog.require('spf');
goog.require('spf.cache');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.dom.url');
goog.require('spf.history');
goog.require('spf.net.scripts');
goog.require('spf.net.styles');
goog.require('spf.net.xhr');
goog.require('spf.state');
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
  if (!spf.state.get('nav-init') && document.addEventListener) {
    document.addEventListener('click', spf.nav.handleClick, false);
    spf.state.set('nav-init', true);
    spf.state.set('nav-listener', spf.nav.handleClick);
  }
};


/**
 * Disposes (disables) pushState navigation.
 */
spf.nav.dispose = function() {
  spf.nav.cancel();
  if (spf.state.get('nav-init')) {
    if (document.removeEventListener) {
      document.removeEventListener('click', /** @type {function(Event)} */ (
          spf.state.get('nav-listener')), false);
    }
    spf.state.set('nav-init', false);
    spf.state.set('nav-listener', null);
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
    return spf.dom.classlist.contains(node, /** @type {string} */ (
        spf.config.get('link-class')));
  });
  if (!linkEl) {
    spf.debug.debug('    ignoring click without link class');
    return;
  }
  // Ignore clicks on targets with the nolink class or within
  // a container with the nolink class.
  if (spf.config.get('nolink-class')) {
    var nolinkEl = spf.dom.getAncestor(evt.target, function(node) {
      return spf.dom.classlist.contains(node, /** @type {string} */ (
          spf.config.get('nolink-class')));
    });
    if (nolinkEl) {
      spf.debug.debug('    ignoring click with nolink class');
      return;
    }
  }
  // Adjust the target element to be the one with an href.
  var target = spf.dom.getAncestor(evt.target, function(node) {
    // Images in IE10 can have an href.
    return node.href && node.tagName.toLowerCase() != 'img';
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
  spf.debug.debug('nav.handleHistory ', '(url=', url, 'state=', opt_state, ')');
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
  // Execute the "navigation requested" callback.  If the callback explicitly
  // returns false, cancel this navigation.
  var val = spf.execute(/** @type {Function} */ (
      spf.config.get('navigate-requested-callback')), url);
  if (val === false) {
    spf.debug.warn('failed in "navigate-requested-callback", canceling',
                   '(val=', val, ')');
    return;
  }
  if (val instanceof Error) {
    spf.debug.warn('failed in "navigate-requested-callback", canceling',
                   '(val=', val, ')');
    spf.nav.error(url, val);
    return;
  }
  // If navigation is requested but SPF is not initialized, redirect.
  if (!spf.state.get('nav-init')) {
    spf.debug.warn('nav not initialized, redirecting ',
                    '(url=', url, ')');
    var err = new Error('Navigation not initialized');
    spf.nav.error(url, err);
    return;
  }
  // Abort previous navigation, if needed.
  spf.nav.cancel();
  // If a session limit has been set and reached, redirect instead of navigate.
  var count = /** @type {number} */ (
      (spf.state.get('navigate-counter') || 0)) + 1;
  var limit = parseInt(spf.config.get('navigate-limit'), 10);
  limit = isNaN(limit) ? Infinity : limit;
  if (count > limit) {
    spf.debug.warn('nav limit reached, redirecting ',
                    '(url=', url, ')');
    var err = new Error('Navigation limit reached');
    spf.nav.error(url, err);
    return;
  }
  spf.state.set('navigate-counter', count);
  // Set the navigation referer, stored in the history entry state object
  // to allow the correct value to be sent to the server during back/forward.
  // Only different than the current URL when navigation is in response to
  // a popState event.
  var referer = opt_referer || window.location.href;
  var navigateError = function(url, err) {
    spf.debug.warn('navigate failed', '(url=', url, ')');
    spf.state.set('nav-request', null);
    if (err instanceof Error) {
      spf.nav.error(url, err);
    }
    return;
  };
  var navigateSuccess = function(url, response) {
    spf.state.set('nav-request', null);
    // Check for redirects.
    if (response['redirect']) {
      var redirectUrl = response['redirect'];
      // Replace the current history entry with the redirect,
      // executing the callback to trigger the next navigation.
      var state = {'spf-referer': referer};
      spf.history.replace(redirectUrl, state, true);
      return;
    }
    // Process the requested response.
    spf.nav.process(response, opt_reverse, true);
  };
  var xhr = spf.nav.request(url, navigateSuccess, navigateError,
                            'navigate', referer);
  spf.state.set('nav-request', xhr);
  // After the request has been sent, check for new navigation that needs
  // a history entry added.  Do this after sending the XHR to have the
  // correct referer for regular navigation (but not history navigation).
  if (!opt_history) {
    try {
      // Add the URL to the history stack.
      var state = {'spf-referer': referer};
      spf.history.add(url, state);
    } catch (err) {
      // Abort previous navigation.
      spf.nav.cancel();
      // An error is thrown if the state object is too large or if the
      // URL is not in the same domain.
      spf.debug.error('error caught, redirecting ',
                      '(url=', url, 'err=', err, ')');
      spf.nav.error(url, err);
      return;
    }
  }
};


/**
 * Cancels the current navigation request, if any.
 */
spf.nav.cancel = function() {
  var xhr = /** @type {XMLHttpRequest} */ (spf.state.get('nav-request'));
  if (xhr) {
    spf.debug.warn('aborting previous navigate ',
                   'xhr=', xhr);
    xhr.abort();
    spf.state.set('nav-request', null);
  }
};


/**
 * Handles a navigation error and redirects (unless cancelled).
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {Error} err The Error object.
 */
spf.nav.error = function(url, err) {
  spf.debug.error('nav.error ', '(url=', url, 'err=', err, ')');
  // Execute the "navigation error" callback.  If the callback explicitly
  // returns false, do not redirect.
  var val = spf.execute(/** @type {Function} */ (
      spf.config.get('navigate-error-callback')), url, err);
  if (val === false) {
    spf.debug.warn('failed in "navigate-error-callback", canceling',
                   '(val=', val, ')');
    return;
  }
  window.location.href = url;
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
 * @param {function(string, Error)=} opt_onError The callback to
 *     execute if the load fails. The first argument is the requested
 *     URL; the second argument is the Error that occurred.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.load = function(url, opt_onSuccess, opt_onError) {
  spf.debug.info('nav.load ', url);
  var loadError = function(url, err) {
    spf.debug.warn('load failed ', '(url=', url, ')');
    if (opt_onError) {
      opt_onError(url, err);
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
  return spf.nav.request(url, loadSuccess, loadError, 'load');
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
 * @param {function(string, (Error|boolean))=} opt_onError The callback to
 *     execute if the request fails. The first argument is the requested
 *     URL; the second argument is the Error that occurred.  If the type of
 *     request is "navigate", the second argument might be false if the
 *     request was canceled in response to the global "navigate-received"
 *     callback.
 * @param {?string=} opt_type The type of request (e.g. "navigate", "load",
 *     etc), used to alter the URL identifier and determine whether the
 *     global "navigation received" callback is executed; defaults to "request".
 * @param {string=} opt_referer The Referrer URL, without the SPF identifier.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.request = function(url, opt_onSuccess, opt_onError, opt_type,
                           opt_referer) {
  spf.debug.debug('nav.request ', url);
  // Convert the URL to absolute, to be used for caching the response.
  var absoluteUrl = spf.dom.url.absolute(url);
  spf.debug.debug('    absolute url ', absoluteUrl);
  // Add the SPF identifier, to be used for sending the request.
  var requestUrl = absoluteUrl;
  var ident = /** @type {string} */ (spf.config.get('url-identifier')) || '';
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
  var onResponseFound = function(response) {
    if (opt_type == 'navigate') {
      // Execute the "navigation received" callback.  If the callback
      // explicitly returns false, cancel this navigation.
      var val = spf.execute(/** @type {Function} */ (
          spf.config.get('navigate-received-callback')), url, response);
      if (val === false || val instanceof Error) {
        spf.debug.warn('failed in "navigate-received-callback", canceling',
                       '(val=', val, ')');
        if (opt_onError) {
          opt_onError(url, val);
        }
        return;
      }
    }
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  var onCacheResponse = function(response) {
    response = /** @type {spf.nav.Response} */ (response);
    // Record responseStart and responseEnd times after loading from cache.
    timing['responseStart'] = timing['responseEnd'] = spf.now();
    timing['navigationStart'] = start;
    // Store the timing for the cached response (avoid stale timing values).
    response['timing'] = timing;
    spf.debug.debug('    cached response found ', response);
    onResponseFound(response);
  };
  var onRequestResponse = function(xhr) {
    spf.debug.debug('    XHR response', 'status=', xhr.status, 'xhr=', xhr);
    // Record the timing information.
    timing['navigationStart'] = start;
    if (xhr['timing']) {
      for (var t in xhr['timing']) {
        timing[t] = xhr['timing'][t];
      }
    }
    // Attempt to parse the response.
    var response;
    try {
      if ('JSON' in window) {
        response = JSON.parse(xhr.responseText);
      } else {
        response = eval('(' + xhr.responseText + ')');
      }
    } catch (err) {
      spf.debug.debug('    JSON parse failed');
      if (opt_onError) {
        opt_onError(url, err);
      }
      return;
    }
    response = /** @type {spf.nav.Response} */ (response);
    // Cache the response for future requests.
    // Use the absolute URL without identifier to allow cached responses
    // from prefetching to apply to navigation.
    spf.cache.set(absoluteUrl, response,  /** @type {number} */ (
        spf.config.get('cache-lifetime')));
    // Set the timing values for the response.
    response['timing'] = timing;
    onResponseFound(response);
  };
  // Try to find a cached response for the request before sending a new XHR.
  // Record fetchStart time before loading from cache.
  timing['fetchStart'] = spf.now()
  // Use the absolute URL without identifier to allow cached responses
  // from prefetching to apply to navigation.
  var cached = spf.cache.get(absoluteUrl);
  if (cached) {
    cached = /** @type {spf.nav.Response} */ (cached);
    // To ensure a similar execution pattern as a request, ensure the
    // cache response is returned asynchronously.
    setTimeout(function() {
      onCacheResponse(cached);
    }, 0);
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
      timeoutMs: /** @type {number} */ (spf.config.get('request-timeout')),
      onSuccess: onRequestResponse,
      onError: onRequestResponse,
      onTimeout: onRequestResponse
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
 * @param {boolean=} opt_notify Whether to execute the global notification
 *     callback if processing succeeds.
 */
spf.nav.process = function(response, opt_reverse, opt_notify) {
  spf.debug.info('nav.process ', response, opt_reverse);
  // Install page styles.
  var cssParseResult = spf.net.styles.parse(response['css']);
  spf.net.styles.install(cssParseResult);
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
      var jsParseResult = spf.net.scripts.parse(response['js']);
      spf.net.scripts.execute(jsParseResult, function() {
        spf.debug.debug('    executed scripts');
        if (opt_notify) {
          // Execute the "navigation processed" callback.  There is no
          // opportunity to cancel the navigation after processing is complete,
          // so explicitly returning false here does nothing.
          var val = spf.execute(/** @type {Function} */ (
              spf.config.get('navigate-processed-callback')), response);
          if (val instanceof Error) {
            spf.debug.warn('failed in "navigate-processed-callback", ignoring',
                           '(val=', val, ')');
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
    var key = spf.key(el);
    var transitionClass = /** @type {string} */ (
        spf.config.get('transition-class'));
    if (!spf.nav.animate_ ||
        !spf.dom.classlist.contains(el, transitionClass)) {
      var jsParseResult = spf.net.scripts.parse(html);
      // If the target element isn't enabled for transitions, just replace.
      // Use the parsed HTML without script tags to avoid any scripts
      // being accidentally considered loading.
      el.innerHTML = jsParseResult.html;
      spf.debug.debug('    updated fragment content ', id);
      // Execute embedded scripts before continuing.
      spf.net.scripts.execute(jsParseResult, function() {
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
        jsParseResult: spf.net.scripts.parse(html),
        currentEl: null,  // Set in Step 1.
        pendingEl: null,  // Set in Step 1.
        parentEl: el,
        currentClass: transitionClass + '-old',
        pendingClass: transitionClass + '-new',
        startClass: !!opt_reverse ?
                        transitionClass + '-reverse-start' :
                        transitionClass + '-forward-start',
        endClass: !!opt_reverse ?
                      transitionClass + '-reverse-end' :
                      transitionClass + '-forward-end'
      };
      // Transition Step 1: Insert new (timeout = 0).
      queue.push([function(data, next) {
        spf.dom.classlist.add(data.parentEl, data.startClass);
        // Reparent the existing elements.
        data.currentEl = document.createElement('div');
        data.currentEl.className = data.currentClass;
        spf.dom.inflateElement(data.parentEl, data.currentEl);
        // Add the new content.
        data.pendingEl = document.createElement('div');
        data.pendingEl.className = data.pendingClass;
        // Use the parsed HTML without script tags to avoid any scripts
        // being accidentally considered loading.
        data.pendingEl.innerHTML = data.jsParseResult.html;
        if (data.reverse) {
          spf.dom.insertSiblingBefore(data.pendingEl, data.currentEl);
        } else {
          spf.dom.insertSiblingAfter(data.pendingEl, data.currentEl);
        }
        next();
      }, 0]);
      // Transition Step 2: Switch between old and new (timeout = 0).
      queue.push([function(data, next) {
        // Start the transition.
        spf.dom.classlist.remove(data.parentEl, data.startClass);
        spf.dom.classlist.add(data.parentEl, data.endClass);
        next();
      }, 0]);
      // Transition Step 3: Remove old (timeout = config duration).
      queue.push([function(data, next) {
        spf.debug.debug('    updated fragment content ', data.parentEl.id);
        // When done, remove the old content.
        data.parentEl.removeChild(data.currentEl);
        // End the transition.
        spf.dom.classlist.remove(data.parentEl, data.endClass);
        // Reparent the new elements.
        spf.dom.flattenElement(data.pendingEl);
        next();
      }, spf.config.get('transition-duration')]);
      // Transition Step 4: Execute scripts (timeout = 0).
      queue.push([function(data, next) {
        // Execute embedded scripts before continuing.
        spf.net.scripts.execute(data.jsParseResult, function() {
          spf.debug.debug('    executed fragment scripts ', data.parentEl.id);
          remaining--;
          maybeContinueAfterContent();
          next();
        });
      }, 0]);
      // Store the steps so the transition can be cleared, if needed.
      var transitions = spf.nav.transitions_();
      transitions[key] = {'timer': 0, 'queue': queue, 'data': data};
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
  var transitions = spf.nav.transitions_();
  if (key in transitions) {
    if (transitions[key]['queue'].length > 0) {
      var step = transitions[key]['queue'].shift();
      if (opt_quick) {
        step[0](transitions[key]['data'], function() {
          spf.nav.process_(key, opt_quick);
        });
      } else {
        transitions[key]['timer'] = setTimeout(function() {
          step[0](transitions[key]['data'], function() {
            spf.nav.process_(key, opt_quick);
          });
        }, step[1]);
      }
    } else {
      clearTimeout(transitions[key]['timer'])
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
 *     the prefetch succeeds.
 * @param {function(string, Error)=} opt_onError The callback to
 *     execute if the prefetch fails. The first argument is the requested
 *     URL; the second argument is the Error that occurred.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.prefetch = function(url, opt_onSuccess, opt_onError) {
  spf.debug.info('nav.prefetch ', url);
  var fetchError = function(url, err) {
    spf.debug.warn('prefetch failed ', '(url=', url, ')');
    if (opt_onError) {
      opt_onError(url, err);
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
  return spf.nav.request(url, fetchSuccess, fetchError, 'prefetch');
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
  var cssParseResult = spf.net.styles.parse(response['css']);
  spf.net.styles.preinstall(cssParseResult);
  spf.debug.debug('    preinstalled styles');
  // Preexecute fragment scripts.
  var fragments = response['html'] || {};
  var jsParseResult;
  for (var id in fragments) {
    jsParseResult = spf.net.scripts.parse(fragments[id]);
    spf.net.scripts.preexecute(jsParseResult);
    spf.debug.debug('    preexecuted fragment scripts ', id);
  }
  // Preexecute page scripts.
  jsParseResult = spf.net.scripts.parse(response['js']);
  spf.net.scripts.preexecute(jsParseResult);
  spf.debug.debug('    preexecuted scripts');
};


/**
 * @param {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>=}
 *     opt_trans Optional map of transitions to overwrite the current value.
 * @return {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>}
 *     Current map of transitions.
 * @private
 */
spf.nav.transitions_ = function(opt_trans) {
  if (opt_trans || !spf.state.has('nav-transitions')) {
    return /** @type {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>} */ (
        spf.state.set('nav-transitions', (opt_trans || {})));
  }
  return /** @type {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>} */ (
      spf.state.get('nav-transitions'));
};


/**
 * Whether the browser supports animation via CSS Transitions.
 * @private {boolean}
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
