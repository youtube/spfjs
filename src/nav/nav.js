/**
 * @fileoverview Functions to handle pushstate-based navigation.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


goog.provide('spf.nav');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.history');
goog.require('spf.nav.request');
goog.require('spf.nav.response');
goog.require('spf.state');


/**
 * Initializes (enables) pushState navigation.
 */
spf.nav.init = function() {
  if (!spf.state.get('nav-init') && document.addEventListener) {
    document.addEventListener('click', spf.nav.handleClick, false);
    spf.state.set('nav-init', true);
    spf.state.set('nav-counter', 0);
    spf.state.set('nav-time', spf.now());
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
    spf.state.set('nav-counter', null);
    spf.state.set('nav-time', null);
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
    spf.nav.error(url);
    return;
  }
  // Abort previous navigation, if needed.
  spf.nav.cancel();
  // If a session limit has been set and reached, redirect.
  var count = (parseInt(spf.state.get('nav-counter'), 10) || 0) + 1;
  var limit = parseInt(spf.config.get('navigate-limit'), 10);
  limit = isNaN(limit) ? Infinity : limit;
  if (count > limit) {
    spf.debug.warn('nav limit reached, redirecting ',
                    '(url=', url, ')');
    spf.nav.error(url);
    return;
  }
  spf.state.set('nav-counter', count);
  // If a session lifetime has been set and reached, redirect.
  var timestamp = parseInt(spf.state.get('nav-time'), 10);
  var age = spf.now() - timestamp;
  var lifetime = parseInt(spf.config.get('navigate-lifetime'), 10);
  lifetime = isNaN(lifetime) ? Infinity : lifetime;
  if (age > lifetime) {
    spf.debug.warn('nav lifetime reached, redirecting ',
                    '(url=', url, ')');
    spf.nav.error(url);
    return;
  }
  spf.state.set('nav-time', spf.now());
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
  };
  var navigatePart = function(url, partial) {
    spf.nav.response.process(partial, opt_reverse);
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
    // If a multipart response was received, all processing is already done,
    // so just execute the global notification.
    if (response['type'] == 'multipart') {
      // Execute the "navigation processed" callback.  There is no
      // opportunity to cancel the navigation after processing is complete,
      // so explicitly returning false here does nothing.
      var val = spf.execute(/** @type {Function} */ (
          spf.config.get('navigate-processed-callback')), response);
      if (val instanceof Error) {
        spf.debug.warn('failed in "navigate-processed-callback", ignoring',
                       '(val=', val, ')');
      }
    } else {
      spf.nav.response.process(response, opt_reverse, true);
    }
  };
  var xhr = spf.nav.request.send(url, {
    onPart: navigatePart,
    onError: navigateError,
    onSuccess: navigateSuccess,
    type: 'navigate',
    referer: referer
  });
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
 * @param {Error=} opt_err The Error object.
 */
spf.nav.error = function(url, opt_err) {
  spf.debug.error('nav.error ', '(url=', url, 'err=', opt_err, ')');
  if (opt_err) {
    // Execute the "navigation error" callback.  If the callback explicitly
    // returns false, do not redirect.
    var val = spf.execute(/** @type {Function} */ (
        spf.config.get('navigate-error-callback')), url, opt_err);
    if (val === false) {
      spf.debug.warn('failed in "navigate-error-callback", canceling',
                     '(val=', val, ')');
      return;
    }
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
  var loadPart = function(url, partial) {
    spf.nav.response.process(partial);
  };
  var loadSuccess = function(url, response) {
    // Check for redirects.
    if (response['redirect']) {
      spf.nav.load(response['redirect'], opt_onSuccess, opt_onError);
      return;
    }
    // Process the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the callback.
    if (response['type'] != 'multipart') {
      spf.nav.response.process(response);
    }
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  return spf.nav.request.send(url, {
    onPart: loadPart,
    onError: loadError,
    onSuccess: loadSuccess,
    type: 'load'
  });
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
  var fetchPart = function(url, partial) {
    spf.nav.response.preprocess(partial);
  };
  var fetchSuccess = function(url, response) {
    // Check for redirects.
    if (response['redirect']) {
      spf.nav.prefetch(response['redirect'], opt_onSuccess, opt_onError);
      return;
    }
    // Preprocess the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the callback.
    if (response['type'] != 'multipart') {
      spf.nav.response.preprocess(response);
    }
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  return spf.nav.request.send(url, {
    onPart: fetchPart,
    onError: fetchError,
    onSuccess: fetchSuccess,
    type: 'prefetch'
  });
};
