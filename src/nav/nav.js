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
  spf.history.init(spf.nav.handleHistory_);
  if (!spf.state.get('nav-init') && document.addEventListener) {
    document.addEventListener('click', spf.nav.handleClick_, false);
    spf.state.set('nav-init', true);
    spf.state.set('nav-counter', 0);
    spf.state.set('nav-time', spf.now());
    spf.state.set('nav-listener', spf.nav.handleClick_);
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
  spf.history.dispose();
};


/**
 * Handles page clicks on SPF links and adds pushState history entries for them.
 *
 * @param {Event} evt The click event.
 * @private
 */
spf.nav.handleClick_ = function(evt) {
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
 * @private
 */
spf.nav.handleHistory_ = function(url, opt_state) {
  var reverse = !!(opt_state && opt_state['spf-back']);
  var referer = opt_state && opt_state['spf-referer'];
  spf.debug.debug('nav.handleHistory ', '(url=', url, 'state=', opt_state, ')');
  // Navigate to the URL.
  spf.nav.navigate_(url, null, referer, true, reverse);
};


/**
 * Navigates to a URL.
 *
 * A pushState history entry is added for the URL, and if successful, the
 * navigation is performed.  If not, the browser is redirected to the URL.
 * During the navigation, first the content is requested.  If the reponse is
 * sucessfully parsed, it is processed.  If not, the browser is redirected to
 * the URL.  Only a single navigation request can be in flight at once.  If a
 * second URL is navigated to while a first is still pending, the first will be
 * cancelled.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {spf.RequestOptions=} opt_options Optional request options object.
 */
spf.nav.navigate = function(url, opt_options) {
  // Ignore navigation to the same page or to an empty URL.
  if (!url || url == window.location.href) {
    return;
  }
  // Navigate to the URL.
  spf.nav.navigate_(url, opt_options);
};


/**
 * Performs navigation to a URL.
 * See {@link #navigate}, {@link #handleClick}, and {@link #handleHistory}.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {string=} opt_referer The Referrer URL, without the SPF identifier.
 *     Defaults to the current URL.
 * @param {boolean=} opt_history Whether this navigation is part of a history
 *     change. True when navigation is in response to a popState event.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @private.
 */
spf.nav.navigate_ = function(url, opt_options, opt_referer, opt_history,
                             opt_reverse) {
  spf.debug.info('nav.navigate ', url, opt_options, opt_referer, opt_history,
                 opt_reverse);
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  // Execute the "navigation requested" callback.  If the callback explicitly
  // returns false, cancel this navigation.
  var val = spf.execute(/** @type {Function} */ (
      spf.config.get('navigate-requested-callback')), url);
  if (val === false || val instanceof Error) {
    spf.debug.warn('failed in "navigate-requested-callback", ',
                   'canceling (val=', val, ')');
    spf.nav.error(url, val);
    return;
  }
  // If navigation is requested but SPF is not initialized, redirect.
  if (!spf.state.get('nav-init')) {
    spf.debug.warn('nav not initialized, redirecting ',
                    '(url=', url, ')');
    spf.nav.redirect(url);
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
    spf.nav.redirect(url);
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
    spf.nav.redirect(url);
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
    if (options['onError']) {
      options['onError'](url, err);
    }
    spf.nav.error(url, err);
  };
  var navigatePart = function(url, partial) {
    // Execute the "navigation received part" callback.  If the callback
    // explicitly returns false, cancel this navigation.
    var val = spf.execute(/** @type {Function} */ (
        spf.config.get('navigate-part-received-callback')), url, partial);
    if (val === false || val instanceof Error) {
      spf.debug.warn('failed in "navigate-part-received-callback", ',
                     'canceling (val=', val, ')');
      // Abort the navigation.
      spf.nav.cancel();
      navigateError(url, val);
      return;
    }
    var navigatePartDone = function() {
      if (options['onPart']) {
        options['onPart'](url, partial);
      }
      // Execute the "navigation processed part" callback.  If the callback
      // explicitly returns false, cancel this navigation.
      var val = spf.execute(/** @type {Function} */ (
          spf.config.get('navigate-part-processed-callback')), partial);
      if (val === false || val instanceof Error) {
        spf.debug.warn('failed in "navigate-part-processed-callback", ',
                       'canceling (val=', val, ')');
        // Abort the navigation.
        spf.nav.cancel();
        navigateError(url, val);
      }
    };
    spf.nav.response.process(url, partial, navigatePartDone, opt_reverse);
  };
  var navigateSuccess = function(url, response) {
    spf.state.set('nav-request', null);
    // Execute the "navigation received" callback.  If the callback
    // explicitly returns false, cancel this navigation.
    var val = spf.execute(/** @type {Function} */ (
        spf.config.get('navigate-received-callback')), url, response);
    if (val === false || val instanceof Error) {
      spf.debug.warn('failed in "navigate-received-callback", ',
                     'canceling (val=', val, ')');
      navigateError(url, val);
      return;
    }
    // Check for redirects.
    if (response['redirect']) {
      var redirectUrl = response['redirect'];
      //
      // TODO(nicksay): Figure out navigate callbacks + redirects.
      //
      // Replace the current history entry with the redirect,
      // executing the callback to trigger the next navigation.
      var state = {'spf-referer': referer};
      spf.history.replace(redirectUrl, state, true);
      return;
    }
    var navigateSuccessDone = function() {
      if (options['onSuccess']) {
        options['onSuccess'](url, response);
      }
      // Execute the "navigation processed" callback.  NOTE: There is no
      // opportunity to cancel the navigation after processing is complete,
      // so explicitly returning false here does nothing.
      var val = spf.execute(/** @type {Function} */ (
          spf.config.get('navigate-processed-callback')), response);
      if (val === false || val instanceof Error) {
        spf.debug.warn('failed in "navigate-processed-callback", ',
                       'ignoring (val=', val, ')');
      }
    };
    // Process the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the global notification.  Call process with an empty
    // object to ensure the callback is properly queued.
    var r = (response['type'] == 'multipart') ? {} : response;
    spf.nav.response.process(url, r, navigateSuccessDone, opt_reverse);
  };
  var xhr = spf.nav.request.send(url, {
    method: options['method'],
    onPart: navigatePart,
    onError: navigateError,
    onSuccess: navigateSuccess,
    postData: options['postData'],
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
      // Abort the navigation.
      spf.nav.cancel();
      // An error is thrown if the state object is too large or if the
      // URL is not in the same domain.
      spf.debug.error('error caught, redirecting ',
                      '(url=', url, 'err=', err, ')');
      navigateError(url, err);
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
 * @param {boolean|Error=} opt_err The Error object (or "false" if an action
 *     was prevented).
 */
spf.nav.error = function(url, opt_err) {
  spf.debug.error('nav.error ', '(url=', url, 'err=', opt_err, ')');
  if (opt_err instanceof Error) {
    // Execute the "navigation error" callback.  If the callback explicitly
    // returns false, do not redirect.
    var val = spf.execute(/** @type {Function} */ (
        spf.config.get('navigate-error-callback')), url, opt_err);
    if (val === false) {
      spf.debug.warn('failed in "navigate-error-callback", ',
                     'canceling (val=', val, ')');
      return;
    }
  }
  spf.nav.redirect(url);
};


/**
 * Redirect to a URL, to be used when navigation fails or is disabled.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 */
spf.nav.redirect = function(url) {
  window.location.href = url;
};


/**
 * Loads a URL.
 *
 * Similar to {@link spf.navigate}, but intended for traditional content
 * updates, not page navigation.  Not subject to restrictions on the number of
 * simultaneous requests.  The content is first requested.  If the response is
 * successfully parsed, it is processed and the URL and response object are
 * passed to the optional {@code onSuccess} callback.  If not, the URL is passed
 * to the optional {@code onError} callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {spf.RequestOptions=} opt_options Optional request options object.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.load = function(url, opt_options) {
  spf.debug.info('nav.load ', url, opt_options);
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var loadError = function(url, err) {
    spf.debug.warn('load failed ', '(url=', url, ')');
    if (options['onError']) {
      options['onError'](url, err);
    }
  };
  var loadPart = function(url, partial) {
    var loadPartDone = function() {
      if (options['onPart']) {
        options['onPart'](url, partial);
      }
    };
    spf.nav.response.process(url, partial, loadPartDone);
  };
  var loadSuccess = function(url, response) {
    // Check for redirects.
    if (response['redirect']) {
      // Note that POST is not propagated with redirects.
      var redirectOpts = /** @type {spf.RequestOptions} */ ({
        'onSuccess': options['onSuccess'],
        'onPart': options['onPart'],
        'onError': options['onError']
      });
      spf.nav.load(response['redirect'], redirectOpts);
      return;
    }
    var loadSuccessDone = function() {
      if (options['onSuccess']) {
        options['onSuccess'](url, response);
      }
    };
    // Process the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the callback.  Call process with an empty
    // object to ensure the callback is properly queued.
    var r = (response['type'] == 'multipart') ? {} : response;
    spf.nav.response.process(url, r, loadSuccessDone);
  };
  return spf.nav.request.send(url, {
    method: options['method'],
    onPart: loadPart,
    onError: loadError,
    onSuccess: loadSuccess,
    postData: options['postData'],
    type: 'load'
  });
};


/**
 * Prefetches a URL.
 *
 * Use to prime the SPF request cache with the content and the browser cache
 * with script and stylesheet URLs.
 *
 * The content is first requested.  If the response is successfully parsed, it
 * is preprocessed to prefetch scripts and stylesheets, and the URL and
 * response object are then passed to the optional {@code onSuccess}
 * callback. If not, the URL is passed to the optional {@code onError}
 * callback.
 *
 * @param {string} url The URL to prefetch, without the SPF identifier.
 * @param {spf.RequestOptions=} opt_options Optional request options object.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.prefetch = function(url, opt_options) {
  spf.debug.info('nav.prefetch ', url, opt_options);
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var prefetchError = function(url, err) {
    spf.debug.warn('prefetch failed ', '(url=', url, ')');
    if (options['onError']) {
      options['onError'](url, err);
    }
  };
  var prefetchPart = function(url, partial) {
    var prefetchPartDone = function() {
      if (options['onPart']) {
        options['onPart'](url, partial);
      }
    };
    spf.nav.response.preprocess(url, partial, prefetchPartDone);
  };
  var prefetchSuccess = function(url, response) {
    // Check for redirects.
    if (response['redirect']) {
      // Note that POST is not propagated with redirects.
      var redirectOpts = /** @type {spf.RequestOptions} */ ({
        'onSuccess': options['onSuccess'],
        'onPart': options['onPart'],
        'onError': options['onError']
      });
      spf.nav.prefetch(response['redirect'], redirectOpts);
      return;
    }
    var prefetchSuccessDone = function() {
      if (options['onSuccess']) {
        options['onSuccess'](url, response);
      }
    };
    // Preprocess the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the callback.  Call process with an empty
    // object to ensure the callback is properly queued.
    var r = (response['type'] == 'multipart') ? {} : response;
    spf.nav.response.preprocess(url, r, prefetchSuccessDone);
  };
  return spf.nav.request.send(url, {
    method: options['method'],
    onPart: prefetchPart,
    onError: prefetchError,
    onSuccess: prefetchSuccess,
    postData: options['postData'],
    type: 'prefetch'
  });
};
