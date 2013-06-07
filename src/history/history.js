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

goog.require('spf.debug');


/**
 * Initialize pushstate-based HTML5 History management.
 *
 * @param {function(string, Object=)} callback The function to handle
 *     a history event. The first parameter will be the URL
 *     the user is browsing to.  The second parameter will be an optional
 *     state object associated with that URL.
 */
spf.history.init = function(callback) {
  if (!spf.history.initialized_) {
    spf.history.initialized_ = true;
    spf.history.callback_ = callback;
    spf.history.url_ = window.location.href;
    spf.history.replace(spf.history.url_);
    window.addEventListener('popstate', spf.history.pop_, false);
  }
};


/**
 * Dispose pushstate-based HTML5 History management.
 */
spf.history.dispose = function() {
  window.removeEventListener('popstate', spf.history.pop_, false);
  spf.history.initialized_ = false;
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
 * @throws {Error} If the state object is too large. For example, Firefox will
 *     pass the object to JSON.stringify and impose a 640k character limit.
 * @throws {Error} If the URL is not in the same domain, a SECURITY_ERR
 *     (code == 18) is thrown.
 */
spf.history.replace = function(opt_url, opt_state, opt_doCallback) {
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
  var url = opt_url || window.location.href;
  var state = opt_state || {};
  spf.history.timestamp_ = spf.now();
  state['spf-timestamp'] = spf.history.timestamp_;
  if (replace) {
    window.history.replaceState(state, '', url);
    spf.debug.debug('    replaceState:  ', 'url=', url, 'state=', state);
  } else {
    window.history.pushState(state, '', url);
    spf.debug.debug('    pushState:  ', 'url=', url, 'state=', state);
  }
  spf.history.url_ = url;
  if (opt_doCallback) {
    spf.history.callback_(url, state);
  }
};


/**
 * Handles popstate events when the active history entry changes.
 *
 * @param {Event} evt The popstate event.
 * @private
 */
spf.history.pop_ = function(evt) {
  var url = window.location.href;
  spf.debug.info('history.pop ', 'url=', url, 'evt=', evt);
  // Avoid the initial event on first load for a state.
  if (evt.state) {
    var state = evt.state;
    // If the URL is the same and a state is present, the browser has left
    // and returned to first load via back/forward.  In this case, reset
    // the state to the original.
    if (url == spf.history.url_) {
      spf.history.timestamp_ = state['spf-timestamp'];
      window.history.replaceState(state, '', url);
      spf.debug.debug('    replaceState:  ', 'url=', url, 'state=', state);
    } else {
      var timestamp = state['spf-timestamp'];
      state['spf-back'] = !!(timestamp < spf.history.timestamp_);
      spf.history.timestamp_ = timestamp;
      spf.history.url_ = url;
      spf.history.callback_(url, state);
    }
  }
};


/**
 * @private {boolean}
 */
spf.history.initialized_ = false;


/**
 * A callback to handle history events.
 * @private {function(string, Object=)}
 */
spf.history.callback_;


/**
 * The timestamp of the current history entry, for distinguishing
 * between backward and forward state changes.
 * @private {number}
 */
spf.history.timestamp_ = 0;


/**
 * The URL of the current history entry.
 * @private {string}
 */
spf.history.url_ = window.location.href;
