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
goog.require('spf.debug');
goog.require('spf.state');


/**
 * Initialize pushstate-based HTML5 History management.
 *
 * @param {function(string, Object=)} callback The function to handle
 *     a history event. The first parameter will be the URL
 *     the user is browsing to.  The second parameter will be an optional
 *     state object associated with that URL.
 */
spf.history.init = function(callback) {
  if (!spf.state.get('history-init') && window.addEventListener) {
    var url = spf.history.getCurrentUrl_();
    window.addEventListener('popstate', spf.history.pop_, false);
    // Whether history is initialized.
    spf.state.set('history-init', true);
    // A callback to handle history events.
    spf.state.set('history-callback', callback);
    // The event listener.
    spf.state.set('history-listener', spf.history.pop_);
    // The URL of the current history entry, used to detect returning to the
    // the first state.
    spf.state.set('history-url', url);
    // The timestap of the current history entry, used to distinguish
    // between backward and forward state changes.
    spf.state.set('history-timestamp', spf.now());
    // Set the initial referer to properly send referer on back button.
    var historyState = { 'spf-referer': document.referrer };
    spf.history.replace(url, historyState);
  }
};


/**
 * Dispose pushstate-based HTML5 History management.
 */
spf.history.dispose = function() {
  if (spf.state.get('history-init')) {
    if (window.removeEventListener) {
      window.removeEventListener('popstate', /** @type {function(Event)} */ (
          spf.state.get('history-listener')), false);
    }
    spf.state.set('history-init', false);
    spf.state.set('history-callback', null);
    spf.state.set('history-listener', null);
    spf.state.set('history-url', null);
    spf.state.set('history-timestamp', 0);
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
 * Replace the current history entry.
 *
 * @param {?string=} opt_url The URL associated with this entry to display in
 *     the browser.  This can be either a relative or an absolute URL, and if
 *     omitted, the current browser URL will be used.
 * @param {Object=} opt_state The state object associated with this history
 *     entry.  When the user returns to this entry, the "state" property of the
 *     event will contain a copy of this object.
 * @param {boolean=} opt_doCallback Whether to do the history event callback.
 * @param {boolean=} opt_retainState Whether to retain existing state if no new
 *     state is provided. Defaults to false.
 * @throws {Error} If the state object is too large. For example, Firefox will
 *     pass the object to JSON.stringify and impose a 640k character limit.
 * @throws {Error} If the URL is not in the same domain, a SECURITY_ERR
 *     (code == 18) is thrown.
 * @throws {Error} If window.history.replaceState is not a function.
 */
spf.history.replace = function(opt_url, opt_state, opt_doCallback,
                               opt_retainState) {
  var currentState = spf.history.getCurrentState_();
  if (opt_retainState && currentState) {
    opt_state = opt_state || currentState;
  }
  spf.debug.info('history.replace ', opt_url);
  spf.history.push_(true, opt_url, opt_state, opt_doCallback);
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
  spf.state.set('history-timestamp', timestamp);
  state['spf-timestamp'] = timestamp;
  if (replace) {
    spf.history.doReplaceState_(state, '', url);
    spf.debug.debug('    replaceState:  ', 'url=', url, 'state=', state);
  } else {
    spf.history.doPushState_(state, '', url);
    spf.debug.debug('    pushState:  ', 'url=', url, 'state=', state);
  }
  spf.state.set('history-url', url);
  if (opt_doCallback) {
    var callback = /** @type {function(string, Object=)} */ (
        spf.state.get('history-callback'));
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
  // Avoid the initial event on first load for a state.
  if (evt.state) {
    var state = evt.state;
    var timestamp = state['spf-timestamp'];
    // If the URL is the same and a state is present, the browser has left
    // and returned to first load via back/forward.  In this case, reset
    // the state to the original.
    if (url == spf.state.get('history-url')) {
      spf.state.set('history-timestamp', timestamp);
      spf.history.doReplaceState_(state, '', url);
      spf.debug.debug('    replaceState:  ', 'url=', url, 'state=', state);
    } else {
      var current = parseInt(spf.state.get('history-timestamp'), 10);
      state['spf-back'] = (timestamp < current);
      state['spf-current'] = spf.state.get('history-url');
      spf.state.set('history-timestamp', timestamp);
      spf.state.set('history-url', url);
      var callback = /** @type {function(string, Object=)} */ (
          spf.state.get('history-callback'));
      if (callback) {
        callback(url, state);
      }
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
  if (typeof window.history.pushState == 'function') {
    window.history.pushState(data, title, opt_url);
  } else {
    // TODO(awbraunstein): Remove this once we gather information on
    // the state of window.history at the time of the error.
    var historyString = '';

    for (var key in window.history) {
      var value = window.history[key];
      var valueString;
      try {
        valueString = JSON.stringify(value) || typeof value;
      } catch (e) {
        valueString = e.message;
      }
      historyString += (key + ': ' + valueString + '\n');
    }
    throw new Error('history.pushState is not a function. window.history: ' +
        historyString);
  }
};


/**
 * @param {*} data New state.
 * @param {string} title The title for a session history entry.
 * @param {string=} opt_url The URL for a new session history entry.
 * @private
 */
spf.history.doReplaceState_ = function(data, title, opt_url) {
  if (typeof window.history.replaceState == 'function') {
    window.history.replaceState(data, title, opt_url);
  } else {
    throw new Error('history.replaceState is not a function');
  }
};
