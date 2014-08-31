// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions to handle pushstate-based navigation.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


goog.provide('spf.nav');

goog.require('spf');
goog.require('spf.array');
goog.require('spf.cache');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.history');
goog.require('spf.nav.request');
goog.require('spf.nav.response');
goog.require('spf.state');
goog.require('spf.tasks');
goog.require('spf.tracing');
goog.require('spf.url');


/**
 * Initializes (enables) pushState navigation.
 */
spf.nav.init = function() {
  spf.history.init(spf.nav.handleHistory_, spf.nav.dispatchError_);
  if (!spf.state.get(spf.state.Key.NAV_INIT) && document.addEventListener) {
    document.addEventListener('click', spf.nav.handleClick_, false);
    if (spf.config.get('experimental-prefetch-mousedown') &&
        !spf.nav.isTouchCapablePlatform_()) {
      document.addEventListener('mousedown', spf.nav.handleMouseDown_, false);
      spf.state.set(spf.state.Key.PREFETCH_LISTENER, spf.nav.handleMouseDown_);
    }
    spf.state.set(spf.state.Key.NAV_INIT, true);
    spf.state.set(spf.state.Key.NAV_COUNTER, 0);
    spf.state.set(spf.state.Key.NAV_TIME, spf.now());
    spf.state.set(spf.state.Key.NAV_LISTENER, spf.nav.handleClick_);
  }
};


/**
 * Disposes (disables) pushState navigation.
 */
spf.nav.dispose = function() {
  spf.nav.cancel();
  if (spf.state.get(spf.state.Key.NAV_INIT)) {
    if (document.removeEventListener) {
      document.removeEventListener('click', /** @type {function(Event)} */ (
          spf.state.get(spf.state.Key.NAV_LISTENER)), false);
      if (spf.config.get('experimental-prefetch-mousedown')) {
        document.removeEventListener('mousedown',
            /** @type {function(Event)} */ (
                spf.state.get(spf.state.Key.PREFETCH_LISTENER)), false);
      }
    }
    spf.state.set(spf.state.Key.NAV_INIT, false);
    spf.state.set(spf.state.Key.NAV_COUNTER, null);
    spf.state.set(spf.state.Key.NAV_TIME, null);
    spf.state.set(spf.state.Key.NAV_LISTENER, null);
  }
  spf.history.dispose();
};


/**
 * Walks up the DOM hierarchy, returning the first ancestor that has the
 * link class.
 *
 * @param {Node|EventTarget} element The DOM node to start with.
 * @return {Node} DOM node with the link class or null if not found.
 * @private
 */
spf.nav.getAncestorWithLinkClass_ = function(element) {
  return spf.dom.getAncestor(element, function(node) {
    return spf.dom.classlist.contains(node, /** @type {string} */ (
        spf.config.get('link-class')));
  });
};


/**
 * Walks up the DOM hierarchy, returning the first ancestor that has the
 * nolink class.
 *
 * @param {Node|EventTarget} element The DOM node to start with.
 * @return {Node} DOM node with the nolink class or null if not found.
 * @private
 */
spf.nav.getAncestorWithNoLinkClass_ = function(element) {
  return spf.dom.getAncestor(element, function(node) {
    return spf.dom.classlist.contains(node, /** @type {string} */ (
        spf.config.get('nolink-class')));
  });
};


/**
 * Walks up the DOM hierarchy, returning the first ancestor with a href.
 *
 * @param {Node|EventTarget} element The DOM node to start with.
 * @param {Node} parent The DOM node to end with.
 * @return {Node} DOM node with a href or null if not found.
 * @private
 */
spf.nav.getAncestorWithHref_ = function(element, parent) {
  return spf.dom.getAncestor(element, function(node) {
    // Images in IE10 can have an href.
    return node.href && node.tagName.toLowerCase() != 'img';
  }, parent);
};


/**
 * Given a mouse event, try to get the corresponding navigation URL.
 *
 * @param {Event} evt The click event.
 * @return {?string} Navigation url of event if applicable.
 * @private
 */
spf.nav.getEventURL_ = function(evt) {
  // Ignore clicks with modifier keys.
  if (evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey) {
    spf.debug.debug('    ignoring click with modifier key');
    return null;
  }
  // Ignore clicks with alternate buttons (left = 0, middle = 1, right = 2).
  if (evt.button > 0) {
    spf.debug.debug('    ignoring click with alternate button');
    return null;
  }
  // Ignore clicks on targets without the link class or not within
  // a container with the link class.
  var linkEl = spf.nav.getAncestorWithLinkClass_(evt.target);
  if (!linkEl) {
    spf.debug.debug('    ignoring click without link class');
    return null;
  }
  // Ignore clicks on targets with the nolink class or within
  // a container with the nolink class.
  if (spf.config.get('nolink-class')) {
    var nolinkEl = spf.nav.getAncestorWithNoLinkClass_(evt.target);
    if (nolinkEl) {
      spf.debug.debug('    ignoring click with nolink class');
      return null;
    }
  }
  var target = spf.nav.getAncestorWithHref_(evt.target, linkEl);
  // Ignore clicks on targets without an href.
  if (!target) {
    spf.debug.debug('    ignoring click without href');
    return null;
  }
  return target.href;
};


/**
 * Whether this URL is allowed for navigation, according to same-origin security
 * policy.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @return {boolean}
 * @private
 */
spf.nav.isAllowed_ = function(url) {
  // If the destination is not same-origin, cancel.
  // TODO(nicksay): Add CORS origin whitelist.
  var destination = spf.url.origin(url);
  if (destination != spf.url.origin(window.location.href)) {
    spf.debug.warn('destination not same-origin');
    return false;
  }
  return true;
};


/**
 * Whether this URL is eligible for navigation, according to the configured
 * limits and lifetime.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @return {boolean}
 * @private
 */
spf.nav.isEligible_ = function(url) {
  // If navigation is requested but SPF is not initialized, cancel.
  if (!spf.state.get(spf.state.Key.NAV_INIT)) {
    spf.debug.warn('navigation not initialized');
    return false;
  }
  // If a session limit has been set and reached, cancel.
  var count = parseInt(spf.state.get(spf.state.Key.NAV_COUNTER), 10) || 0;
  count++;
  var limit = parseInt(spf.config.get('navigate-limit'), 10);
  limit = isNaN(limit) ? Infinity : limit;
  if (count > limit) {
    spf.debug.warn('navigation limit reached');
    return false;
  }
  // If a session lifetime has been set and reached, cancel.
  var timestamp = parseInt(spf.state.get(spf.state.Key.NAV_TIME), 10);
  timestamp--;
  var age = spf.now() - timestamp;
  var lifetime = parseInt(spf.config.get('navigate-lifetime'), 10);
  lifetime = isNaN(lifetime) ? Infinity : lifetime;
  if (age > lifetime) {
    spf.debug.warn('navigation lifetime reached');
    return false;
  }
  return true;
};


/**
 * Handles page click events on SPF links, adds pushState history entries for
 * them, and navigates.
 *
 * @param {Event} evt The click event.
 * @private
 */
spf.nav.handleClick_ = function(evt) {
  spf.debug.debug('nav.handleClick ', 'evt=', evt);
  if (evt.defaultPrevented) {
    // Allow other click handlers to cancel navigation.
    return;
  }
  var url = spf.nav.getEventURL_(evt);
  if (url === null) {
    // Ignore clicks if there's no relevant URL for the event target.
    return;
  }
  // Do nothing if click is to the same page or an empty URL.
  if (!url || url == window.location.href) {
    spf.debug.debug('    ignoring click to same page');
    // Prevent the default browser navigation to avoid reloads.
    evt.preventDefault();
    return;
  }
  if (spf.config.get('experimental-same-origin')) {
    // Ignore clicks if the URL is not allowed (e.g. cross-domain).
    if (!spf.nav.isAllowed_(url)) {
      return;
    }
  }
  // Ignore clicks if the URL is not eligible (e.g. limit reached).
  if (!spf.nav.isEligible_(url)) {
    return;
  }
  // Ignore clicks if the "click" event is canceled.
  if (!spf.nav.dispatchClick_(url, evt.target)) {
    return;
  }

  // Navigate to the URL.
  spf.nav.navigate_(url);
  // Prevent the default browser navigation to avoid reloads.
  evt.preventDefault();
};


/**
 * Handles page mousedown events on SPF links and prefetches them if possible.
 *
 * @param {Event} evt The mousedown event.
 * @private
 */
spf.nav.handleMouseDown_ = function(evt) {
  spf.debug.debug('nav.handleMouseDown ', 'evt=', evt);
  var url = spf.nav.getEventURL_(evt);
  // Ignore clicks to the same page or to empty URLs.
  if (!url || url == window.location.href) {
    return;
  }
  // Allow other mousedown handlers to run before issuing a prefetch request.
  setTimeout(function() {
    spf.nav.prefetch(/** @type {string} */(url));
  }, 0);
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
  var current = opt_state && opt_state['spf-current'];
  spf.debug.debug('nav.handleHistory ', '(url=', url, 'state=', opt_state, ')');
  if (spf.config.get('experimental-same-origin')) {
    // Reload if the URL is not allowed (e.g. cross-domain).
    if (!spf.nav.isAllowed_(url)) {
      spf.nav.reload(url, spf.nav.ReloadReason.FORBIDDEN);
      return;
    }
  }
  // Reload if the URL is not eligible (e.g. limit reached).
  if (!spf.nav.isEligible_(url)) {
    spf.nav.reload(url, spf.nav.ReloadReason.INELIGIBLE);
    return;
  }
  // Ignore the change if the "history" event is canceled.
  if (!spf.nav.dispatchHistory_(url, referer, current)) {
    return;
  }
  // Navigate to the URL.
  spf.nav.navigate_(url, null, current, referer, true, reverse);
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
  spf.debug.debug('nav.navigate ', '(url=', url, 'options=', opt_options, ')');
  // Ignore navigation to the same page or to an empty URL.
  if (!url || url == window.location.href) {
    return;
  }
  if (spf.config.get('experimental-same-origin')) {
    // Reload if the URL is not allowed (e.g. cross-domain).
    if (!spf.nav.isAllowed_(url)) {
      spf.nav.reload(url, spf.nav.ReloadReason.FORBIDDEN);
      return;
    }
  }
  // Reload if the URL is not eligible (e.g. limit reached).
  if (!spf.nav.isEligible_(url)) {
    spf.nav.reload(url, spf.nav.ReloadReason.INELIGIBLE);
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
 * @param {string=} opt_current The current page URL. This differs from the
 *     referer in that is always represents the current visible page regardless
 *     of history state.
 * @param {string=} opt_referer The Referrer URL, without the SPF identifier.
 *     Defaults to the current URL.
 * @param {boolean=} opt_history Whether this navigation is part of a history
 *     change. True when navigation is in response to a popState event.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @private.
 */
spf.nav.navigate_ = function(url, opt_options, opt_current, opt_referer,
                             opt_history, opt_reverse) {
  spf.debug.info('nav.navigate_ ', url, opt_options, opt_current,
                 opt_referer, opt_history, opt_reverse);
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});

  // Set the navigation counter.
  var count = (parseInt(spf.state.get(spf.state.Key.NAV_COUNTER), 10) || 0) + 1;
  spf.state.set(spf.state.Key.NAV_COUNTER, count);
  // Set the navigation time.
  spf.state.set(spf.state.Key.NAV_TIME, spf.now());
  // Set the navigation referer, stored in the history entry state object
  // to allow the correct value to be sent to the server during back/forward.
  // Only different than the current URL when navigation is in response to
  // a popState event.
  // Compare against "undefined" to allow empty referrer values in history.
  var referer = opt_referer == undefined ? window.location.href : opt_referer;
  spf.state.set(spf.state.Key.NAV_REFERER, referer);
  // The current URL will have already changed for history events, so in those
  // cases the current URL is provided from state. The opt_current should
  // always be used for history states. If it's unavailable that indicates the
  // visible page is undetermined and should not be relied upon.
  var current = opt_history ? opt_current : window.location.href;

  // Reload if the "request" event is canceled.
  if (!spf.nav.dispatchRequest_(url, referer, current, options)) {
    spf.nav.reload(url, spf.nav.ReloadReason.REQUEST_CANCELED);
    return;
  }

  // Abort previous navigation, if needed.
  spf.nav.cancel();
  // Abort all ongoing prefetch requests, except for the navigation one if it
  // exists.  This will reduce network contention for the navigation request
  // by eliminating concurrent reqeuests that will not be used.
  spf.nav.cancelAllPrefetchesExcept(url);
  // Cancel all preprocessing being done for completed single or ongoing
  // multipart prefetch response, except for the navigation one if it exists.
  // If the navigation one is a completed single response, the task will be
  // canceled in spf.nav.navigatePromotePrefetch_.  If it is an ongoing
  // multipart response, allow it to continue processing until the completed.
  var absoluteUrl = spf.url.absolute(url);
  var preprocessKey = spf.nav.preprocessKey(absoluteUrl);
  spf.tasks.cancelAllExcept('preprocess', preprocessKey);

  // Set the current nav request to be the prefetch, if it exists.
  var prefetches = spf.nav.prefetches_();
  var prefetchXhr = prefetches[absoluteUrl];
  spf.state.set(spf.state.Key.NAV_REQUEST, prefetchXhr);
  // Make sure there is no current nav promotion set.
  spf.state.set(spf.state.Key.NAV_PROMOTE, null);
  spf.state.set(spf.state.Key.NAV_PROMOTE_TIME, null);

  // Check the prefetch XHR.  If it is not done, promote the prefetch
  // to navigate.  Otherwise, navigate immediately.
  if (prefetchXhr && prefetchXhr.readyState != 4) {
    // Begin the prefetch promotion process.
    spf.nav.navigatePromotePrefetch_(url, options, referer,
                                     !!opt_history, !!opt_reverse);
  } else {
    spf.nav.navigateSendRequest_(url, options, current, referer,
                                 !!opt_history, !!opt_reverse);
  }
};


/**
 * Promotes a prefetch request to a navigation after it completes.
 * See {@link navigate}.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} referer The Referrer URL, without the SPF identifier.
 * @param {boolean} history Whether this navigation is part of a history
 *     change. True when navigation is in response to a popState event.
 * @param {boolean} reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @private
 */
spf.nav.navigatePromotePrefetch_ = function(url, options, referer, history,
                                            reverse) {
  spf.debug.debug('nav.navigatePromotePrefetch_ ', url);
  var preprocessKey = spf.nav.preprocessKey(url);
  var promoteKey = spf.nav.promoteKey(url);
  spf.state.set(spf.state.Key.NAV_PROMOTE, url);
  spf.state.set(spf.state.Key.NAV_PROMOTE_TIME, spf.now());
  spf.tasks.cancel(preprocessKey);
  spf.tasks.run(promoteKey, true);

  // After starting the promote tasks, check for new navigation that needs
  // a history entry added.
  if (!history) {
    var handleError = spf.bind(spf.nav.handleNavigateError_, null,
                               options);
    spf.nav.navigateAddHistory_(url, referer, handleError);
  }
};


/**
 * Send the navigation request.
 * See {@link navigate}.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {spf.RequestOptions} options The request options object.
 * @param {string|undefined} current The current page URL, without the SPF
 *     identifier.
 * @param {string} referer The Referrer URL, without the SPF identifier.
 * @param {boolean} history Whether this navigation is part of a history
 *     change. True when navigation is in response to a popState event.
 * @param {boolean} reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @private
 */
spf.nav.navigateSendRequest_ = function(url, options, current, referer,
                                        history, reverse) {
  var handleError = spf.bind(spf.nav.handleNavigateError_, null,
                             options);
  var handlePart = spf.bind(spf.nav.handleNavigatePart_, null,
                            options, reverse);
  var handleSuccess = spf.bind(spf.nav.handleNavigateSuccess_, null,
                               options, reverse, '');

  var xhr = spf.nav.request.send(url, {
    method: options['method'],
    onPart: handlePart,
    onError: handleError,
    onSuccess: handleSuccess,
    postData: options['postData'],
    type: 'navigate' + (history ? (reverse ? '-back' : '-forward') : ''),
    current: current,
    referer: referer
  });
  spf.state.set(spf.state.Key.NAV_REQUEST, xhr);

  // After the request has been sent, check for new navigation that needs
  // a history entry added.  Do this after sending the XHR to have the
  // correct referer for regular navigation (but not history navigation).
  if (!history) {
    spf.nav.navigateAddHistory_(url, referer, handleError);
  }
};


/**
 * Add the navigate state to the history.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {string} referer The Referrer URL, without the SPF identifier.
 * @param {function(string, Error)} handleError The error handler the navigate.
 * @private
 */
spf.nav.navigateAddHistory_ = function(url, referer, handleError) {
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
    handleError(url, err);
  }
};


/**
 * Handles a navigation error.
 * See {@link navigate}.
 *
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {Error} err The Error object.
 * @private
 */
spf.nav.handleNavigateError_ = function(options, url, err) {
  spf.debug.warn('navigate error', '(url=', url, ')');
  spf.state.set(spf.state.Key.NAV_REQUEST, null);
  // Ignore the error if the "error" event is canceled, but otherwise,
  // reload the page.
  if (!spf.nav.dispatchError_(url, err, options)) {
    return;
  }
  var reason = spf.nav.ReloadReason.ERROR;
  if (err) {
    reason += ' Message: ' + err.message;
  }
  spf.nav.reload(url, reason);
};


/**
 * Handles a navigation partial response.
 * See {@link navigate}.
 *
 * @param {spf.RequestOptions} options Request options object.
 * @param {boolean} reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse} partial The partial response object.
 * @private
 */
spf.nav.handleNavigatePart_ = function(options, reverse, url, partial) {
  // Reload if the "part process" event is canceled.
  if (!spf.nav.dispatchPartProcess_(url, partial, options)) {
    spf.nav.reload(url, spf.nav.ReloadReason.PART_PROCESS_CANCELED);
    return;
  }

  // Check for redirect responses.
  if (partial['redirect']) {
    spf.nav.handleNavigateRedirect_(options, partial['redirect']);
    return;
  }

  try {
    spf.nav.response.process(url, partial, function() {
      spf.nav.dispatchPartDone_(url, partial, options);
    }, true, reverse);
  } catch (err) {
    // If an exception is caught during processing, log, execute the error
    // handler, and bail.
    spf.debug.debug('    failed to process part', partial);
    spf.nav.handleNavigateError_(options, url, err);
    return;
  }
};


/**
 * Handles a navigation complete response.
 * See {@link navigate}.
 *
 * @param {spf.RequestOptions} options Request options object.
 * @param {boolean} reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and navigation is in response to a
 *     popState event.
 * @param {string} original The original request URL. This parameter
 *     is the empty string if the navigate request was not a promotion.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The response
 *     object, either a complete single or multipart response object.
 * @private
 */
spf.nav.handleNavigateSuccess_ = function(options, reverse, original,
                                          url, response) {
  spf.state.set(spf.state.Key.NAV_REQUEST, null);

  // If this is a navigation from a promotion, manually set the
  // navigation start time.
  if (spf.state.get(spf.state.Key.NAV_PROMOTE) == original) {
    var timing = response['timing'] || {};
    timing['navigationStart'] = spf.state.get(spf.state.Key.NAV_PROMOTE_TIME);
    timing['spfPrefetched'] = true;
  }

  // If a multipart response was received, all processing is already done,
  // so don't fire the "process" event/callbacks.
  var multipart = response['type'] == 'multipart';
  if (!multipart) {
    // Reload if the "process" event is canceled.
    if (!spf.nav.dispatchProcess_(url, response, options)) {
      spf.nav.reload(url, spf.nav.ReloadReason.PROCESS_CANCELED);
      return;
    }

    // Check for redirect responses.
    if (response['redirect']) {
      spf.nav.handleNavigateRedirect_(options, response['redirect']);
      return;
    }
  }

  // Process the requested response.
  try {
    // If a multipart response was received, all processing is already done,
    // so an empty object is used to ensure events/callbacks are properly
    // queued after existing ones from any ongoing part prcoessing.
    var r = /** @type {spf.SingleResponse} */ (multipart ? {} : response);
    spf.nav.response.process(url, r, function() {
      spf.nav.dispatchDone_(url, response, options);
    }, true, reverse);
  } catch (err) {
    // If an exception is caught during processing, log, execute the error
    // handler and bail.
    spf.debug.debug('    failed to process response', response);
    spf.nav.handleNavigateError_(options, url, err);
    return;
  }
};


/**
 * Handles a redirect responses on navigation requests.
 *
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} redirectUrl The new URL to be redirected to.
 * @private
 */
spf.nav.handleNavigateRedirect_ = function(options, redirectUrl) {
  //
  // TODO(nicksay): Figure out navigate callbacks + redirects.
  //
  // Replace the current history entry with the redirect,
  // executing the callback to trigger the next navigation.
  try {
    // Persist the url hash to mirror browser redirects.
    redirectUrl = redirectUrl + window.location.hash;
    spf.history.replace(redirectUrl, null, true, true);
  } catch (err) {
    spf.nav.cancel();
    spf.debug.error('error caught, redirecting ',
                    '(url=', redirectUrl, 'err=', err, ')');
    spf.nav.handleNavigateError_(options, redirectUrl, err);
  }
};


/**
 * Cancels the current navigation request, if any.
 */
spf.nav.cancel = function() {
  var xhr = /** @type {XMLHttpRequest} */ (
      spf.state.get(spf.state.Key.NAV_REQUEST));
  if (xhr) {
    spf.debug.warn('aborting previous navigate ',
                   'xhr=', xhr);
    xhr.abort();
    spf.state.set(spf.state.Key.NAV_REQUEST, null);
  }
};


/**
 * Executes an external callback and checks whether the callback was canceled
 * with an explicit return value of {@code false}.
 *
 * @param {Function|undefined} fn Callback function to be executed.
 * @param {...*} var_args Arguments to apply to the function.
 * @return {boolean} False if the callback was canceled by explicitly returning
 *     false to stop the operation; true otherwise.
 */
spf.nav.callback = function(fn, var_args) {
  var val;
  if (fn) {
    var args = Array.prototype.slice.call(arguments);
    args[0] = fn;
    val = spf.execute.apply(null, args);
    if (val instanceof Error) {
      spf.debug.error('error in callback (url=', window.location.href,
                      'err=', val, ')');
    }
  }
  return (val !== false);
};


/**
 * Redirect to a URL, to be used when navigation fails or is disabled.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {string} reason The reason code causing the reload.
 */
spf.nav.reload = function(url, reason) {
  spf.debug.warn('redirecting (', 'url=', url, 'reason=', reason, ')');
  spf.nav.cancel();
  spf.nav.cancelAllPrefetchesExcept();
  // Dispatch the reload event to notify the app that a reload is required.
  spf.nav.dispatchReload_(url, reason);
  // If the url has already changed, clear its entry to prevent browser
  // inconsistency with history management for 301 responses on reloads. Chrome
  // will identify that the starting url was the same, and replace the current
  // history state, whereas Firefox will set a new state with the post 301
  // value.
  if (spf.config.get('experimental-remove-history') &&
      window.location.href == url) {
    spf.history.removeCurrentEntry();
  }
  // Delay the redirect until after the history state has had time to clear.
  setTimeout(function() {
    window.location.href = url;
  }, 0);
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
 */
spf.nav.load = function(url, opt_options) {
  spf.nav.load_(url, opt_options);
};


/**
 * Loads a URL.
 * See {@link #load}.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {spf.RequestOptions=} opt_options Optional request options object.
 * @param {string=} opt_original The original request URL.
 * @private
 */
spf.nav.load_ = function(url, opt_options, opt_original) {
  spf.debug.info('nav.load ', url, opt_options, opt_original);
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var original = opt_original || url;

  // Abort the load if the "request" callback is canceled.
  // Note: pass "true" to only execute callbacks and not dispatch events.
  if (!spf.nav.dispatchRequest_(url, undefined, undefined, options, true)) {
    return;
  }

  var handleError = spf.bind(spf.nav.handleLoadError_, null,
                             false, options, original);
  var handlePart = spf.bind(spf.nav.handleLoadPart_, null,
                            false, options, original);
  var handleSuccess = spf.bind(spf.nav.handleLoadSuccess_, null,
                               false, options, original);

  spf.nav.request.send(url, {
    method: options['method'],
    onPart: handlePart,
    onError: handleError,
    onSuccess: handleSuccess,
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
 */
spf.nav.prefetch = function(url, opt_options) {
  spf.nav.prefetch_(url, opt_options);
};


/**
 * Prefetches a URL.
 * See {@link #prefetch}.
 *
 * @param {string} url The URL to prefetch, without the SPF identifier.
 * @param {spf.RequestOptions=} opt_options Optional request options object.
 * @param {string=} opt_original The original request URL.
 * @private
 */
spf.nav.prefetch_ = function(url, opt_options, opt_original) {
  spf.debug.info('nav.prefetch ', url, opt_options, opt_original);
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var original = opt_original || url;
  var current = window.location.href;

  // Abort the prefetch if the "request" callback is canceled.
  // Note: pass "true" to only execute callbacks and not dispatch events.
  if (!spf.nav.dispatchRequest_(url, undefined, undefined, options, true)) {
    return;
  }

  var handleError = spf.bind(spf.nav.handleLoadError_, null,
                             true, options, original);
  var handlePart = spf.bind(spf.nav.handleLoadPart_, null,
                            true, options, original);
  var handleSuccess = spf.bind(spf.nav.handleLoadSuccess_, null,
                               true, options, original);

  var xhr = spf.nav.request.send(url, {
    method: options['method'],
    onPart: handlePart,
    onError: handleError,
    onSuccess: handleSuccess,
    postData: options['postData'],
    type: 'prefetch',
    current: current
  });
  spf.nav.addPrefetch(url, xhr);
};


/**
 * Handles a load or prefetch error.
 * See {@link load} and {@link prefetch}.
 *
 * @param {boolean} isPrefetch True for prefetch; false for load.
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} original The original request URL.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {Error} err The Error object.
 * @private
 */
spf.nav.handleLoadError_ = function(isPrefetch, options, original, url, err) {
  spf.debug.warn(isPrefetch ? 'prefetch' : 'load', 'error', '(url=', url, ')');

  if (isPrefetch) {
    spf.nav.removePrefetch(url);
  }

  // If a prefetch has been promoted to a navigate, use the navigate error
  // handler.  Otherwise, execute the "error" callback.
  if (isPrefetch && spf.state.get(spf.state.Key.NAV_PROMOTE) == original) {
    spf.nav.handleNavigateError_(options, url, err);
  } else {
    // Note: pass "true" to only execute callbacks and not dispatch events.
    spf.nav.dispatchError_(url, err, options, true);
  }
};


/**
 * Handles a load or prefetch partial response.
 * See {@link load} and {@link prefetch}.
 *
 * @param {boolean} isPrefetch True for prefetch; false for load.
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} original The original request URL.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse} partial The partial response object.
 * @private
 */
spf.nav.handleLoadPart_ = function(isPrefetch, options, original, url,
                                   partial) {
  // Abort the load/prefetch if the "part process" callback is canceled.
  // Note: pass "true" to only execute callbacks and not dispatch events.
  if (!spf.nav.dispatchPartProcess_(url, partial, options, true)) {
    return;
  }

  // Check for redirects.
  if (partial['redirect']) {
    spf.nav.handleLoadRedirect_(isPrefetch, options, original,
                                partial['redirect']);
    return;
  }

  if (isPrefetch) {
    // Add the navigate part function as a task to be invoked on
    // prefetch promotion.
    var fn = spf.bind(spf.nav.handleNavigatePart_, null,
                      options, false, url, partial);
    var promoteKey = spf.nav.promoteKey(original);
    spf.tasks.add(promoteKey, fn);
    // If the prefetch has been promoted, run the promotion task after
    // adding it and do not perform any preprocessing.
    if (spf.state.get(spf.state.Key.NAV_PROMOTE) == original) {
      spf.tasks.run(promoteKey, true);
      return;
    }
  }

  var processFn = isPrefetch ?
      spf.nav.response.preprocess :
      spf.nav.response.process;
  processFn(url, partial, function() {
    // Note: pass "true" to only execute callbacks and not dispatch events.
    spf.nav.dispatchPartDone_(url, partial, options, true);
  });
};


/**
 * Handles a load or prefetch complete response.
 * See {@link load} and {@link prefetch}.
 *
 * @param {boolean} isPrefetch True for prefetch; false for load.
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} original The original request URL.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The response
 *     object, either a complete single or multipart response object.
 * @private
 */
spf.nav.handleLoadSuccess_ = function(isPrefetch, options, original, url,
                                      response) {
  // If a multipart response was received, all processing is already done,
  // so don't execute the "process" callback.
  var multipart = response['type'] == 'multipart';
  if (!multipart) {
    // Abort the load/prefetch if the "process" callback is canceled.
    // Note: pass "true" to only execute callbacks and not dispatch events.
    if (!spf.nav.dispatchProcess_(url, response, options, true)) {
      spf.nav.reload(url, spf.nav.ReloadReason.PROCESS_CANCELED);
      return;
    }

    // Check for redirect responses.
    if (response['redirect']) {
      spf.nav.handleLoadRedirect_(isPrefetch, options, original,
                                  response['redirect']);
      return;
    }
  }

  var promoteKey = spf.nav.promoteKey(original);
  if (isPrefetch) {
    // Remove the prefetch xhr from the set of currently active
    // prefetches upon successful prefetch.
    spf.nav.removePrefetch(url);
    // If the prefetch has been promoted, run the promotion task after
    // adding it and do not perform any preprocessing. If it has not
    // been promoted, remove the task queues becuase a subsequent
    // request will hit the cache.
    if (spf.state.get(spf.state.Key.NAV_PROMOTE) == original) {
      var fn = spf.bind(spf.nav.handleNavigateSuccess_, null,
                        options, false, original, url, response);
      spf.tasks.add(promoteKey, fn);
      spf.tasks.run(promoteKey, true);
      return;
    } else {
      spf.tasks.cancel(promoteKey);
    }
  }

  // Process the requested response.
  var processFn = isPrefetch ?
      spf.nav.response.preprocess :
      spf.nav.response.process;
  try {
    // If a multipart response was received, all processing is already done,
    // so an empty object is used to ensure the callback is properly
    // queued after existing ones from any ongoing part prcoessing.
    var r = /** @type {spf.SingleResponse} */ (multipart ? {} : response);
    processFn(url, r, function() {
      // Note: pass "true" to only execute callbacks and not dispatch events.
      spf.nav.dispatchDone_(url, response, options, true);
    });
  } catch (err) {
    // If an exception is caught during processing, log, execute the error
    // handler and bail.
    spf.debug.debug('    failed to process response', response);
    spf.nav.handleLoadError_(isPrefetch, options, original, url, err);
    return;
  }
};


/**
 * Handles a redirect response on load requests.
 *
 * @param {boolean} isPrefetch True for prefetch; false for load.
 * @param {spf.RequestOptions} options Request options object.
 * @param {string} original The original request URL.
 * @param {string} redirectUrl The new URL to be redirected to.
 * @private
 */
spf.nav.handleLoadRedirect_ = function(isPrefetch, options, original,
                                       redirectUrl) {
  var redirectFn = isPrefetch ? spf.nav.prefetch_ : spf.nav.load_;
  // Note that POST is not propagated with redirects.
  // Only copy callback keys to into a new object to enforce this.
  var keys = [
      spf.nav.Callback.ERROR,
      spf.nav.Callback.REQUEST,
      spf.nav.Callback.PART_PROCESS,
      spf.nav.Callback.PART_DONE,
      spf.nav.Callback.PROCESS,
      spf.nav.Callback.DONE
  ];
  var redirectOpts = /** @type {spf.RequestOptions} */ ({});
  spf.array.each(keys, function(key) {
    redirectOpts[key] = options[key];
  });
  redirectFn(redirectUrl, redirectOpts, original);
};


/**
 * Dispatches the "error" event with the following custom event detail:
 *   url: The current URL.
 *   err: The Error object.
 *
 * If a local "onError" callback is provided, it is executed first with the
 * same detail object.  If the callback is canceled, the event is not fired.
 *
 * @param {string} url The history URL.
 * @param {Error} err The Error object.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {boolean=} opt_noEvents Whether to skip the event and only execute the
 *     callback; for use with load and prefetch requests.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchError_ = function(url, err, opt_options, opt_noEvents) {
  var detail = {'url': url, 'err': err};
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var fn = options[spf.nav.Callback.ERROR];
  var proceed = spf.nav.callback(fn, detail);
  if (proceed && !opt_noEvents) {
    proceed = spf.dispatch(spf.EventName.ERROR, detail);
  }
  return proceed;
};


/**
 * Dispatches the "reload" event with the following custom event detail:
 *   url: The current URL.
 *   reason: The reason code and text explaining the reload.
 *
 * @param {string} url The target URL which is being reloaded.
 * @param {string} reason The reason code causing the reload.
 * @private
 */
spf.nav.dispatchReload_ = function(url, reason) {
  var detail = {'url': url, 'reason': reason};
  spf.dispatch(spf.EventName.RELOAD, detail);
};


/**
 * Dispatches the "click" event with the following custom event detail:
 *   url: The click URL, without the SPF identifier.
 *   target: The click target.
 *
 * @param {string} url The click URL, without the SPF identifier.
 * @param {EventTarget} target The click target.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchClick_ = function(url, target) {
  var detail = {'url': url, 'target': target};
  return spf.dispatch(spf.EventName.CLICK, detail);
};


/**
 * Dispatches the "history" event with the following custom event detail:
 *   url: The click URL, without the SPF identifier.
 *   referer: The referring page URL, without the SPF identifier.
 *   previous: The previously visible page URL, without the SPF identifier.
 *
 * @param {string} url The click URL, without the SPF identifier.
 * @param {string=} opt_referer The referer URL.
 * @param {string=} opt_previous The previously visible URL.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchHistory_ = function(url, opt_referer, opt_previous) {
  var detail = {'url': url, 'referer': opt_referer, 'previous': opt_previous};
  return spf.dispatch(spf.EventName.HISTORY, detail);
};


/**
 * Dispatches the "request" event with the follow custom event detail:
 *   url: The URL to request, without the SPF identifier.
 *   referer: The referring page URL, without the SPF identifier.
 *   previous: The previously visible page URL, without the SPF identifier.
 *
 * If a local "onRequest" callback is provided, it is executed first with the
 * same detail object.  If the callback is canceled, the event is not fired.
 *
 * @param {string} url The URL to request, without the SPF identifier.
 * @param {string|undefined} referer The referer URL.
 * @param {string|undefined} previous The previously visible URL.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {boolean=} opt_noEvents Whether to skip the event and only execute the
 *     callback; for use with load and prefetch requests.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchRequest_ = function(url, referer, previous, opt_options,
                                    opt_noEvents) {
  var detail = {'url': url, 'referer': referer, 'previous': previous};
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var fn = options[spf.nav.Callback.REQUEST];
  var proceed = spf.nav.callback(fn, detail);
  if (proceed && !opt_noEvents) {
    proceed = spf.dispatch(spf.EventName.REQUEST, detail);
  }
  return proceed;
};


/**
 * Dispatches the "part process" event with the follow custom event detail:
 *   url: The requested URL, without the SPF identifier.
 *   part: The partial response object, a part of a multipart response.
 *
 * If a local "onPartProcess" callback is provided, it is executed first with
 * the same detail object.  If the callback is canceled, the event is not fired.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse} partial The partial response object,
 *     part of a multipart response object.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {boolean=} opt_noEvents Whether to skip the event and only execute the
 *     callback; for use with load and prefetch requests.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchPartProcess_ = function(url, partial, opt_options,
                                        opt_noEvents) {
  var detail = {'url': url, 'part': partial};
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var fn = options[spf.nav.Callback.PART_PROCESS];
  var proceed = spf.nav.callback(fn, detail);
  if (proceed && !opt_noEvents) {
    proceed = spf.dispatch(spf.EventName.PART_PROCESS, detail);
  }
  return proceed;
};


/**
 * Dispatches the "part done" event with the follow custom event detail:
 *   url: The requested URL, without the SPF identifier.
 *   part: The partial response object, a part of a multipart response.
 *
 * If a local "onPartDone" callback is provided, it is executed first with the
 * same detail object.  If the callback is canceled, the event is not fired.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse} partial The partial response object,
 *     part of a multipart response object.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {boolean=} opt_noEvents Whether to skip the event and only execute the
 *     callback; for use with load and prefetch requests.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchPartDone_ = function(url, partial, opt_options, opt_noEvents) {
  var detail = {'url': url, 'part': partial};
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var fn = options[spf.nav.Callback.PART_DONE];
  var proceed = spf.nav.callback(fn, detail);
  if (proceed && !opt_noEvents) {
    proceed = spf.dispatch(spf.EventName.PART_DONE, detail);
  }
  return proceed;
};


/**
 * Dispatches the "process" event with the follow custom event detail:
 *   url: The requested URL, without the SPF identifier.
 *   response: The response object, either a single or multipart response.
 *
 * If a local "onProcess" callback is provided, it is executed first with the
 * same detail object.  If the callback is canceled, the event is not fired.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The response
 *     object, either a complete single or multipart response object.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {boolean=} opt_noEvents Whether to skip the event and only execute the
 *     callback; for use with load and prefetch requests.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchProcess_ = function(url, response, opt_options, opt_noEvents) {
  var detail = {'url': url, 'response': response};
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var fn = options[spf.nav.Callback.PROCESS];
  var proceed = spf.nav.callback(fn, detail);
  if (proceed && !opt_noEvents) {
    proceed = spf.dispatch(spf.EventName.PROCESS, detail);
  }
  return proceed;
};


/**
 * Dispatches the "done" event with the follow custom event detail:
 *   url: The requested URL, without the SPF identifier.
 *   response: The response object, either a single or multipart response.
 *
 * If a local "onDone" callback is provided, it is executed first with the
 * same detail object.  If the callback is canceled, the event is not fired.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The response
 *     object, either a complete single or multipart response object.
 * @param {?spf.RequestOptions=} opt_options Optional request options object.
 * @param {boolean=} opt_noEvents Whether to skip the event and only execute the
 *     callback; for use with load and prefetch requests.
 * @return {boolean} False if the event was canceled.
 * @private
 */
spf.nav.dispatchDone_ = function(url, response, opt_options, opt_noEvents) {
  var detail = {'url': url, 'response': response};
  var options = opt_options || /** @type {spf.RequestOptions} */ ({});
  var fn = options[spf.nav.Callback.DONE];
  var proceed = spf.nav.callback(fn, detail);
  if (proceed && !opt_noEvents) {
    proceed = spf.dispatch(spf.EventName.DONE, detail);
  }
  return proceed;
};


/**
 * Generate the promote key given a url.
 *
 * @param {string} url The url of the request.
 * @return {string} The promote key.
 */
spf.nav.promoteKey = function(url) {
  return 'promote ' + spf.url.absolute(url);
};


/**
 * Generate the preprocess key given a url.
 *
 * @param {string} url The url of the request.
 * @return {string} The preprocess key.
 */
spf.nav.preprocessKey = function(url) {
  return 'preprocess ' + spf.url.absolute(url);
};


/**
 * Add a prefetch request to the set of ongoing prefetches.
 *
 * @param {string} url The url of the prefetch request.
 * @param {XMLHttpRequest} xhr The prefetch request object.
 */
spf.nav.addPrefetch = function(url, xhr) {
  spf.debug.debug('nav.addPrefetch ', url, xhr);
  var absoluteUrl = spf.url.absolute(url);
  var prefetches = spf.nav.prefetches_();
  prefetches[absoluteUrl] = xhr;
};


/**
 * Cancels a single prefetch request and removes it from the set.
 *
 * @param {string} url The url of the prefetch to be aborted.
 */
spf.nav.removePrefetch = function(url) {
  spf.debug.debug('nav.removePrefetch ', url);
  var absoluteUrl = spf.url.absolute(url);
  var prefetches = spf.nav.prefetches_();
  var prefetchXhr = prefetches[absoluteUrl];
  if (prefetchXhr) {
    prefetchXhr.abort();
  }
  delete prefetches[absoluteUrl];
};


/**
 * Cancels all ongoing prefetch requests, optionally skipping the given url.
 *
 * @param {string=} opt_skipUrl A url of the request that should not
 *     be canceled.
 */
spf.nav.cancelAllPrefetchesExcept = function(opt_skipUrl) {
  spf.debug.debug('nav.cancelAllPrefetchesExcept', opt_skipUrl);
  var prefetches = spf.nav.prefetches_();
  var absoluteUrl = opt_skipUrl && spf.url.absolute(opt_skipUrl);
  for (var key in prefetches) {
    if (absoluteUrl != key) {
      spf.nav.removePrefetch(key);
    }
  }
};


/**
 * @param {!Object.<string, XMLHttpRequest>=} opt_reqs
 *     Optional set of requests to overwrite the current value.
 * @return {!Object.<string, XMLHttpRequest>} Current map
 *     of requests.
 * @private
 */
spf.nav.prefetches_ = function(opt_reqs) {
  if (opt_reqs || !spf.state.has(spf.state.Key.NAV_PREFETCHES)) {
    return /** @type {!Object.<string, XMLHttpRequest>} */ (
        spf.state.set(spf.state.Key.NAV_PREFETCHES, (opt_reqs || {})));
  }
  return /** @type {!Object.<string, XMLHttpRequest>} */ (
      spf.state.get(spf.state.Key.NAV_PREFETCHES));
};


/**
 * Detects touch-capable platforms.
 *
 * @return {boolean} True if this is a touch capable platform.
 * @private
 */
spf.nav.isTouchCapablePlatform_ = function() {
  return ('ontouchstart' in window || window.navigator['maxTouchPoints'] > 0 ||
      window.navigator['msMaxTouchPoints'] > 0);
};


/**
 * @enum {string}
 */
spf.nav.Callback = {
  ERROR: 'onError',
  REQUEST: 'onRequest',
  PART_PROCESS: 'onPartProcess',
  PART_DONE: 'onPartDone',
  PROCESS: 'onProcess',
  DONE: 'onDone'
};


/**
 * @enum {string}
 */
spf.nav.ReloadReason = {
  INELIGIBLE: (!SPF_DEBUG) ? '1' :
      '1: Navigation not initialized or limit reached.',
  REQUEST_CANCELED: (!SPF_DEBUG) ? '2' :
      '2: Navigation canceled by the request event.',
  PART_PROCESS_CANCELED: (!SPF_DEBUG) ? '3' :
      '3: Navigation canceled by the partprocess event.',
  PROCESS_CANCELED: (!SPF_DEBUG) ? '4' :
      '4: Navigation canceled by the process event.',
  FORBIDDEN: (!SPF_DEBUG) ? '9' :
      '9: Destination forbidden by same-origin security.',
  ERROR: (!SPF_DEBUG) ? '10' :
      '10: An uncaught error occurred processing.'
};


if (spf.tracing.ENABLED) {
  (function() {
    spf.nav.init = spf.tracing.instrument(
        spf.nav.init, 'spf.nav.init');
    spf.nav.dispose = spf.tracing.instrument(
        spf.nav.dispose, 'spf.nav.dispose');
    spf.nav.handleClick_ = spf.tracing.instrument(
        spf.nav.handleClick_, 'spf.nav.handleClick_');
    spf.nav.handleHistory_ = spf.tracing.instrument(
        spf.nav.handleHistory_, 'spf.nav.handleHistory_');
    spf.nav.navigate = spf.tracing.instrument(
        spf.nav.navigate, 'spf.nav.navigate');
    spf.nav.navigate_ = spf.tracing.instrument(
        spf.nav.navigate_, 'spf.nav.navigate_');
    spf.nav.navigatePromotePrefetch_ = spf.tracing.instrument(
        spf.nav.navigatePromotePrefetch_, 'spf.nav.navigatePromotePrefetch_');
    spf.nav.navigateSendRequest_ = spf.tracing.instrument(
        spf.nav.navigateSendRequest_, 'spf.nav.navigateSendRequest_');
    spf.nav.handleNavigateError_ = spf.tracing.instrument(
        spf.nav.handleNavigateError_, 'spf.nav.handleNavigateError_');
    spf.nav.handleNavigatePart_ = spf.tracing.instrument(
        spf.nav.handleNavigatePart_, 'spf.nav.handleNavigatePart_');
    spf.nav.handleNavigateSuccess_ = spf.tracing.instrument(
        spf.nav.handleNavigateSuccess_, 'spf.nav.handleNavigateSuccess_');
    spf.nav.cancel = spf.tracing.instrument(
        spf.nav.cancel, 'spf.nav.cancel');
    spf.nav.callback = spf.tracing.instrument(
        spf.nav.callback, 'spf.nav.callback');
    spf.nav.reload = spf.tracing.instrument(
        spf.nav.reload, 'spf.nav.reload');
    spf.nav.load = spf.tracing.instrument(
        spf.nav.load, 'spf.nav.load');
    spf.nav.handleLoadError_ = spf.tracing.instrument(
        spf.nav.handleLoadError_, 'spf.nav.handleLoadError_');
    spf.nav.handleLoadPart_ = spf.tracing.instrument(
        spf.nav.handleLoadPart_, 'spf.nav.handleLoadPart_');
    spf.nav.handleLoadSuccess_ = spf.tracing.instrument(
        spf.nav.handleLoadSuccess_, 'spf.nav.handleLoadSuccess_');
  })();
}
