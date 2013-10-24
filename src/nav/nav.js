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
goog.require('spf.nav.url');
goog.require('spf.state');
goog.require('spf.tasks');


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
  // cancels (by returning false), cancel this navigation and redirect.
  if (!spf.nav.callback('navigate-requested-callback', url)) {
    spf.nav.redirect(url);
    return;
  }
  // If navigation is requested but SPF is not initialized, redirect.
  if (!spf.state.get('nav-init')) {
    spf.debug.warn('navigation not initialized');
    spf.nav.redirect(url);
    return;
  }
  // If a session limit has been set and reached, redirect.
  var count = (parseInt(spf.state.get('nav-counter'), 10) || 0) + 1;
  var limit = parseInt(spf.config.get('navigate-limit'), 10);
  limit = isNaN(limit) ? Infinity : limit;
  if (count > limit) {
    spf.debug.warn('navigation limit reached');
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
    spf.debug.warn('navigation lifetime reached');
    spf.nav.redirect(url);
    return;
  }
  spf.state.set('nav-time', spf.now());
  // Set the navigation referer, stored in the history entry state object
  // to allow the correct value to be sent to the server during back/forward.
  // Only different than the current URL when navigation is in response to
  // a popState event.
  var referer = opt_referer || window.location.href;

  // Cancel all prefetches but the the prefetch we wish to use before
  // navigating.
  var key = 'preprocess ' + spf.nav.url.absolute(url);
  var prefetches = spf.nav.prefetches_();
  var prefetchXhr = prefetches[url];
  spf.tasks.cancelAll('preprocess', key);
  // Abort all ongoing prefetch xhrs except the one that we are
  // navigating to.
  spf.nav.abortAllPrefetches(url);
  // Abort previous navigation, if needed.
  spf.nav.cancel();
  // Set the current nav request to be the prefetch xhr.
  spf.state.set('nav-request', prefetchXhr);
  // Make sure there is no current nav-intention set.
  spf.state.set('nav-intention', undefined);
  // Check the prefetch xhr. If it is not done, state our intention to
  // navigate. Otherwise, cancel that task and navigate
  if (prefetchXhr && prefetchXhr.readyState != 4) {
    // Wait for completion by stating our intention to navigate and
    // let the onSuccess handler take care of the navigation.
    var prefetchToNavigate = function(prefetchUrl) {
      // Verify that the navigate url and the prefetch url are the
      // same. Once all of the prefetches are killed and nav-intention
      // has been set, other prefetches can still start. If prefetch B
      // starts after navigate request A, and prefetch B finishes before
      // the prefetch A, the completion of prefetch B will start the
      // navigateRequest before prefetch A has finished, resulting in
      // a cache miss.
      if (prefetchUrl != url) {
        return false;
      }
      spf.state.set('nav-intention', undefined);
      spf.tasks.cancel(key);
      spf.nav.navigateRequest_(url, options, referer,
                               opt_history, opt_reverse);
      return true;
    };
    spf.state.set('nav-intention', prefetchToNavigate);
    return;
  }

  spf.nav.navigateRequest_(url, options, referer,
                           opt_history, opt_reverse);
};


/**
 * Create the navigation request.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} referer The Referrer URL, without the SPF identifier.
 * @param {boolean=} opt_history Whether this navigation is part of a history
 *     change. True when navigation is in response to a popState event.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @private
 */
spf.nav.navigateRequest_ = function(url, options, referer,
                                    opt_history, opt_reverse) {
  var navigateError = function(url, err) {
    spf.debug.warn('navigate failed', '(url=', url, ')');
    spf.state.set('nav-request', null);
    // Execute the "onError" and "navigation error" callbacks.  If either
    // explicitly cancels (by returning false), ignore the error.
    // Otherwise, redirect.
    if (!spf.nav.callback(options['onError'], url, err)) {
      return;
    }
    if (!spf.nav.callback('navigate-error-callback', url, err)) {
      return;
    }
    spf.nav.redirect(url);
  };
  var navigatePart = function(url, partial) {
    // Execute the "navigation part received" callback.  If the callback
    // explicitly cancels (by returning false), cancel this navigation and
    // redirect.
    if (!spf.nav.callback('navigate-part-received-callback', url, partial)) {
      spf.nav.redirect(url);
      return;
    }
    var navigatePartDone = function() {
      // Execute the "onPart" and "navigation part processed" callbacks.  If
      // either explicitly cancels (by returning false), cancel this navigation
      // and redirect.
      if (!spf.nav.callback(options['onPart'], url, partial)) {
        spf.nav.redirect(url);
        return;
      }
      if (!spf.nav.callback('navigate-part-processed-callback', url, partial)) {
        spf.nav.redirect(url);
        return;
      }
    };
    spf.nav.response.process(url, partial, navigatePartDone, opt_reverse);
  };
  var navigateSuccess = function(url, response) {
    spf.state.set('nav-request', null);
    // Execute the "navigation received" callback.  If the callback
    // explicitly cancels (by returning false), cancel this navigation and
    // redirect.
    if (!spf.nav.callback('navigate-received-callback', url, response)) {
      spf.nav.redirect(url);
      return;
    }

    // Check for redirect responses.
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
      // Execute the "onSuccess" and "navigation processed" callbacks.
      // NOTE: If either explicitly cancels (by returning false), nothing
      // happens, because there is no longer an opportunity to stop navigation.
      if (!spf.nav.callback(options['onSuccess'], url, response)) {
        return;
      }
      spf.nav.callback('navigate-processed-callback', url, response);
    };
    // Process the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the global notification.  Call process with an empty
    // object to ensure the callback is properly queued.
    var r = (response['type'] == 'multipart') ? {} : response;
    spf.nav.response.process(url, r, navigateSuccessDone, opt_reverse);
  };
  var startTime = /** @type {number} */ (spf.state.get('nav-time'));
  var xhr = spf.nav.request.send(url, {
    method: options['method'],
    onPart: navigatePart,
    onError: navigateError,
    onSuccess: navigateSuccess,
    postData: options['postData'],
    type: 'navigate',
    referer: referer,
    startTime: startTime
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
 * Executes an external callback and checks whether the callbacks was canceled
 * with an explicit return value of {@code false}.
 *
 * @param {Function|string} fn Callback function to be executed.
 * @param {...*} var_args Arguments to apply to the function.
 * @return {boolean} False if the callback explicitly returned false to cancel
 *     the operation; true otherwise.
 */
spf.nav.callback = function(fn, var_args) {
  if (typeof fn == 'string') {
    fn = /** @type {Function} */ (spf.config.get(fn));
  }
  var args = Array.prototype.slice.call(arguments, 0);
  args[0] = fn;
  var val = spf.execute.apply(null, args);
  if (val instanceof Error) {
    spf.debug.error('error in callback (url=', window.location.href,
                    'err=', val, ')');
  }
  return (val !== false);
};


/**
 * Redirect to a URL, to be used when navigation fails or is disabled.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 */
spf.nav.redirect = function(url) {
  spf.debug.warn('redirecting (', 'url=', url, ')');
  spf.nav.cancel();
  spf.nav.abortAllPrefetches();
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
    spf.nav.callback(options['onError'], url, err);
  };
  var loadPart = function(url, partial) {
    var loadPartDone = function() {
      spf.nav.callback(options['onPart'], url, partial);
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
      spf.nav.callback(options['onSuccess'], url, response);
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
    spf.nav.callback(options['onError'], url, err);
    spf.nav.removePrefetch(url);
  };
  var prefetchPart = function(url, partial) {
    var prefetchPartDone = function() {
      spf.nav.callback(options['onPart'], url, partial);
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
      spf.nav.callback(options['onSuccess'], url, response);
    };
    // Check if there is a navigation intention. If there is, then we
    // create the navigation request.
    spf.nav.removePrefetch(url);
    var navIntent = /** @type {Function} */ (
        spf.state.get('nav-intention'));
    if (navIntent && navIntent(url)) {
      return;
    }
    // Preprocess the requested response.
    // If a multipart response was received, all processing is already done,
    // so just execute the callback.  Call process with an empty
    // object to ensure the callback is properly queued.
    var r = (response['type'] == 'multipart') ? {} : response;
    spf.nav.response.preprocess(url, r, prefetchSuccessDone);
  };
  var xhr = spf.nav.request.send(url, {
    method: options['method'],
    onPart: prefetchPart,
    onError: prefetchError,
    onSuccess: prefetchSuccess,
    postData: options['postData'],
    type: 'prefetch'
  });

  spf.nav.addPrefetch(url, xhr);

  return xhr;
};


/**
 * Add a prefetch request to the set of ongoing prefetches.
 *
 * @param {string} url The url of the prefetch request.
 * @param {XMLHttpRequest} xhr The prefetch request object.
 */
spf.nav.addPrefetch = function(url, xhr) {
  spf.debug.debug('nav.addPrefetch ', url, xhr);
  var absoluteUrl = spf.nav.url.absolute(url);
  var prefetches = spf.nav.prefetches_();
  prefetches[absoluteUrl] = xhr;
};


/**
 * Removes a prefetch request from the set of prefetches.
 *
 * @param {string} url The url of the prefetch that is going to be
 *     removed.
 */
spf.nav.removePrefetch = function(url) {
  spf.debug.debug('nav.removePrefetch ', url);
  var absoluteUrl = spf.nav.url.absolute(url);
  var prefetches = spf.nav.prefetches_();
  delete prefetches[absoluteUrl];
};


/**
 * Abort all ongoing prefetches requests. If the skip url is given, do
 * not abort that url.
 *
 * @param {string=} opt_skipUrl A url of the request that should not
 *     be canceled.
 */
spf.nav.abortAllPrefetches = function(opt_skipUrl) {
  spf.debug.debug('nav.abortAllPrefetches');
  var prefetches = spf.nav.prefetches_();
  for (var key in prefetches) {
    if (opt_skipUrl != key) {
      spf.nav.abortPrefetch(key);
    }
  }
};


/**
 * Abort a single prefetch request.
 *
 * @param {string} url The url of the prefetch to be aborted.
 */
spf.nav.abortPrefetch = function(url) {
  spf.debug.debug('nav.abortPrefetch ', url);
  var absoluteUrl = spf.nav.url.absolute(url);
  var prefetches = spf.nav.prefetches_();
  prefetches[absoluteUrl].abort();
  delete prefetches[absoluteUrl];
};


/**
 * @param {!Object.<string, XMLHttpRequest>=} opt_reqs
 *     Optional set of requests to overwrite the current value.
 * @return {!Object.<string, XMLHttpRequest>} Current map
 *     of requests.
 * @private
 */
spf.nav.prefetches_ = function(opt_reqs) {
  if (opt_reqs || !spf.state.has('nav-prefetches')) {
    return /** @type {!Object.<string, XMLHttpRequest>} */ (
        spf.state.set('nav-prefetches', (opt_reqs || {})));
  }
  return /** @type {!Object.<string, XMLHttpRequest>} */ (
      spf.state.get('nav-prefetches'));
};
