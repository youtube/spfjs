// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for detecting and creating history entries
 * using the HTML5 history modification API.  It enables browser history
 * (e.g. back/forward) and URL updates without leaving the current page,
 * as long as the url is within the same domain.
 * See {@link http://www.w3.org/TR/html5/history.html}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.history');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.state');


/**
 * Initialize pushstate-based HTML5 History management.
 *
 * @param {function(string, Object=)} callback The function to handle
 *     a history event. The first parameter will be the URL
 *     the user is browsing to.  The second parameter will be an optional
 *     state object associated with that URL.
 * @param {function(string, Error)} errorCallback The function to handle
 *     errors. The first parameter will be the URL with the error.  The
 *     second parameter will be the error object.
 */
spf.history.init = function(callback, errorCallback) {
  if (!spf.state.get(spf.state.Key.HISTORY_INIT) && window.addEventListener) {
    var url = spf.history.getCurrentUrl_();
    window.addEventListener('popstate', spf.history.pop_, false);
    // Whether history is initialized.
    spf.state.set(spf.state.Key.HISTORY_INIT, true);
    // A callback to handle history events.
    spf.state.set(spf.state.Key.HISTORY_CALLBACK, callback);
    // A callback to handle errors.
    spf.state.set(spf.state.Key.HISTORY_ERROR_CALLBACK, errorCallback);
    // The event listener.
    spf.state.set(spf.state.Key.HISTORY_LISTENER, spf.history.pop_);
    // The URL of the current history entry, used to detect returning to the
    // the first state.
    spf.state.set(spf.state.Key.HISTORY_URL, url);
    // The timestamp of the current history entry, used to distinguish
    // between backward and forward state changes.
    spf.state.set(spf.state.Key.HISTORY_TIMESTAMP, spf.now());
    // Set the initial referer to properly send referer on back button.
    var historyState = { 'spf-referer': document.referrer };
    try {
      spf.history.replace(url, historyState);
    } catch (err) {
      // If history.replaceState was null an error will be thrown.
      if (errorCallback) {
        errorCallback(url, err);
      }
    }
  }
};


/**
 * Dispose pushstate-based HTML5 History management.
 */
spf.history.dispose = function() {
  if (spf.state.get(spf.state.Key.HISTORY_INIT)) {
    if (window.removeEventListener) {
      window.removeEventListener('popstate', /** @type {function(Event)} */ (
          spf.state.get(spf.state.Key.HISTORY_LISTENER)), false);
    }
    spf.state.set(spf.state.Key.HISTORY_INIT, false);
    spf.state.set(spf.state.Key.HISTORY_CALLBACK, null);
    spf.state.set(spf.state.Key.HISTORY_ERROR_CALLBACK, null);
    spf.state.set(spf.state.Key.HISTORY_LISTENER, null);
    spf.state.set(spf.state.Key.HISTORY_URL, null);
    spf.state.set(spf.state.Key.HISTORY_TIMESTAMP, 0);
  }
};


/**
 * Add a history entry.
 *
 * @param {?string=} opt_url The URL associated with this entry to display in
 *     the browser.  This can be either a relative or an absolute URL, and if
 *     omitted, the current browser URL will be used.
 * @param {Object=} opt_state The state object associated with this history
 *     entry.  When the user returns to this entry, the "state" property of the
 *     event will contain a copy of this object.
 * @param {boolean=} opt_doCallback Whether to do the history event callback.
 * @throws {Error} If the state object is too large. For example, Firefox will
 *     pass the object to JSON.stringify and impose a 640k character limit.
 * @throws {Error} If the URL is not in the same domain, a SECURITY_ERR
 *     (code == 18) is thrown.
 * @throws {Error} If window.history.pushState is not a function.
 */
spf.history.add = function(opt_url, opt_state, opt_doCallback) {
  spf.debug.info('history.add ', opt_url);
  spf.history.push_(false, opt_url, opt_state, opt_doCallback);
};


/**
 * Replace the current history entry, merging any newly provided state values
 * with existing ones.
 *
 * @param {?string=} opt_url The URL associated with this entry to display in
 *     the browser.  This can be either a relative or an absolute URL, and if
 *     omitted, the current browser URL will be used.
 * @param {Object=} opt_state The state object associated with this history
 *     entry.  When the user returns to this entry, the "state" property of the
 *     event will contain a copy of this object.
 * @param {boolean=} opt_doCallback Whether to do the history event callback.
 * @throws {Error} If the state object is too large. For example, Firefox will
 *     pass the object to JSON.stringify and impose a 640k character limit.
 * @throws {Error} If the URL is not in the same domain, a SECURITY_ERR
 *     (code == 18) is thrown.
 * @throws {Error} If window.history.replaceState is not a function.
 */
spf.history.replace = function(opt_url, opt_state, opt_doCallback) {
  var state = null;
  // Set the existing state values.
  var currentState = spf.history.getCurrentState_();
  if (currentState) {
    state = {};
    for (var key in currentState) {
      state[key] = currentState[key];
    }
  }
  // Update the state values with new ones.
  if (opt_state) {
    state = state || {};
    for (var key in opt_state) {
      state[key] = opt_state[key];
    }
  }
  spf.debug.info('history.replace ', opt_url);
  spf.history.push_(true, opt_url, state, opt_doCallback);
};


/**
 * Remove the latest history state from the stack.
 * NOTE: If this is called without a state having been pushed, it will result in
 * a back action to the last page. Use with care.
 */
spf.history.removeCurrentEntry = function() {
  spf.state.set(spf.state.Key.HISTORY_IGNORE_POP, true);
  window.history.back();
};


/**
 * See {@link #add} or {@link #replace}.
 *
 * @param {boolean} replace Whether to replace the previous entry.
 * @param {?string=} opt_url The URL associated with this entry.
 * @param {Object=} opt_state The state object associated with this entry.
 * @param {boolean=} opt_doCallback Whether to do the history event callback.
 * @private
 */
spf.history.push_ = function(replace, opt_url, opt_state, opt_doCallback) {
  if (!opt_url && !opt_state) {
    return;
  }
  var url = opt_url || spf.history.getCurrentUrl_();
  var state = opt_state || {};
  var timestamp = spf.now();
  spf.state.set(spf.state.Key.HISTORY_TIMESTAMP, timestamp);
  state['spf-timestamp'] = timestamp;
  if (replace) {
    spf.history.doReplaceState_(state, '', url);
    spf.debug.debug('    replaceState:  ', 'url=', url, 'state=', state);
  } else {
    spf.history.doPushState_(state, '', url);
    spf.debug.debug('    pushState:  ', 'url=', url, 'state=', state);
  }
  spf.state.set(spf.state.Key.HISTORY_URL, url);
  if (opt_doCallback) {
    var callback = /** @type {function(string, Object=)} */ (
        spf.state.get(spf.state.Key.HISTORY_CALLBACK));
    if (callback) {
      callback(url, state);
    }
  }
};


/**
 * Handles popstate events when the active history entry changes.
 *
 * @param {Event} evt The popstate event.
 * @private
 */
spf.history.pop_ = function(evt) {
  var url = spf.history.getCurrentUrl_();
  spf.debug.info('history.pop ', 'url=', url, 'evt=', evt);
  // Skip a pop event and reset flag if the ignore state is set.
  if (spf.state.get(spf.state.Key.HISTORY_IGNORE_POP)) {
    spf.state.set(spf.state.Key.HISTORY_IGNORE_POP, false);
    return;
  }
  // Avoid the initial event on first load, and ignore events for history
  // entries that are not handled by SPF (e.g. when navigating within a page
  // using links with hash-only URLs, there are no associated states).
  if (!evt.state) {
    return;
  }
  var state = evt.state;
  var timestamp = state['spf-timestamp'];
  // If the URL is the same and a state is present, the browser has left
  // and returned to first load via back/forward.  In this case, reset
  // the state to the original.
  if (url == spf.state.get(spf.state.Key.HISTORY_URL)) {
    spf.state.set(spf.state.Key.HISTORY_TIMESTAMP, timestamp);
    spf.history.doReplaceState_(state, '', url);
    spf.debug.debug('    replaceState:  ', 'url=', url, 'state=', state);
  } else {
    var current = parseInt(spf.state.get(spf.state.Key.HISTORY_TIMESTAMP), 10);
    state['spf-back'] = (timestamp < current);
    state['spf-current'] = spf.state.get(spf.state.Key.HISTORY_URL);
    spf.state.set(spf.state.Key.HISTORY_TIMESTAMP, timestamp);
    spf.state.set(spf.state.Key.HISTORY_URL, url);
    var callback = /** @type {function(string, Object=)} */ (
        spf.state.get(spf.state.Key.HISTORY_CALLBACK));
    if (callback) {
      callback(url, state);
    }
  }
};


/**
 * @return {string} The location href.
 * @private
 */
spf.history.getCurrentUrl_ = function() {
  return window.location.href;
};


/**
 * @return {Object} The current history state object.
 * @private
 */
spf.history.getCurrentState_ = function() {
  return /** @type {Object} */ (window.history.state);
};


/**
 * @param {*} data New state.
 * @param {string} title The title for a new session history entry.
 * @param {string=} opt_url The URL for a new session history entry.
 * @private
 */
spf.history.doPushState_ = function(data, title, opt_url) {
  // It is common for third party code to interfere with pushState.
  // This check makes sure that pushState is a function when called to
  // avoid js errors and a state where the back arrow stops working.
  var iframe = spf.history.getIframe();
  var pushState = iframe.contentWindow.history.pushState;
  if (typeof pushState == 'function') {
    pushState.call(window.history, data, title, opt_url);
  } else {
    throw new Error('history.pushState is not a function.');
  }
};


/**
 * @param {*} data New state.
 * @param {string} title The title for a session history entry.
 * @param {string=} opt_url The URL for a new session history entry.
 * @private
 */
spf.history.doReplaceState_ = function(data, title, opt_url) {
  var iframe = spf.history.getIframe();
  var replaceState = iframe.contentWindow.history.replaceState;
  if (typeof replaceState == 'function') {
    replaceState.call(window.history, data, title, opt_url);
  } else {
    throw new Error('history.replaceState is not a function');
  }
};


/**
 * @return {!HTMLIFrameElement} The history iframe.
 */
spf.history.getIframe = function() {
  var frame = document.getElementById('history-iframe');
  if (!frame) {
    frame = spf.dom.createIframe('history-iframe');
  }
  return /** @type {!HTMLIFrameElement} */ (frame);
};
