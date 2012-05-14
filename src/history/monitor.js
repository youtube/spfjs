// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview A History management class for detecting and creating
 * history entries using the HTML5 history modification API.  It enables
 * browser history (e.g. back/forward) without leaving the current page,
 * as long as the url is within the same domain.
 * See {@link http://www.w3.org/TR/html5/history.html}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.history.Monitor');

goog.require('spf.debug');



/**
 * Constructs a object to monitor and modify browser history using the HTML5
 * history modification API.
 *
 * @param {function(string, Object=)} callback The function to handle
 *     a history event. The first parameter will be the URL
 *     the user is browsing to.  The second parameter will be an optional
 *     state object associated with that URL.
 * @constructor
 */
spf.history.Monitor = function(callback) {
  /**
   * A callback to handle history events.
   * @type {function(string, Object=)}
   * @private
   */
  this.callback_ = callback;

  /**
   * The timestamp of the current history entry, for distinguishing
   * between backward and forward state changes.
   * @type {number}
   * @private
   */
  this.timestamp_ = 0;

  /**
   * The URL of the current history entry.
   * @type {string}
   * @private
   */
  this.url_ = window.location.href;

  var self = this;
  /**
   * A cached and locally bound function to use for handling popstate events.
   * @type {Function}
   * @private
   */
  this.handlePop_ = function() {
    self.handlePop.apply(self, arguments);
  };
};


/**
 * Starts managing history entries.  The callback will be immediately executed
 * for the current url unless disabled by the {@code opt_skipCallback} argument.
 *
 * @param {boolean=} opt_skipCallback Whether to skip the callback.
 */
spf.history.Monitor.prototype.enable = function(opt_skipCallback) {
  this.url_ = window.location.href;
  this.replace(this.url_, null, opt_skipCallback);
  window.addEventListener('popstate', this.handlePop_, false);
};


/**
 * Stops managing history entries.
 */
spf.history.Monitor.prototype.disable = function() {
  window.removeEventListener('popstate', this.handlePop_, false);
};


/**
 * Handles popstate events when the active history entry changes.
 *
 * @param {Event} evt The popstate event.
 */
spf.history.Monitor.prototype.handlePop = function(evt) {
  var url = window.location.href;
  spf.debug.info('spf.history.handlePop: ', 'url=', url, 'evt=', evt);
  spf.debug.debug('new url: ', url != this.url_);
  spf.debug.debug('current timestamp: ', this.timestamp_);
  // Avoid the initial event on first load by for a state.
  if (evt.state) {
    var state = evt.state;
    // If the URL is the same and a state is present, the browser has left
    // and returned to first load via back/forward.  In this case, reset
    // the state to the original.
    if (url == this.url_) {
      this.timestamp_ = state['spf-timestamp'];
      spf.debug.debug('replace: ', 'url=', url, 'state=', state);
      window.history.replaceState(state, '', url);
    } else {
      var timestamp = state['spf-timestamp'];
      state['spf-back'] = !!(timestamp < this.timestamp_);
      this.timestamp_ = timestamp;
      spf.debug.debug('callback: ', 'url=', url, 'state=', state);
      this.url_ = url;
      this.callback_(url, state);
    }
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
 * @param {boolean=} opt_skipCallback Whether to skip calling the callback.
 * @throws {Error} If the state object is too large. For example, Firefox will
 *     pass the object to JSON.stringify and impose a 640k character limit.
 * @throws {Error} If the URL is not in the same domain, a SECURITY_ERR
 *     (code == 18) is thrown.
 */
spf.history.Monitor.prototype.add = function(opt_url, opt_state,
                                             opt_skipCallback) {
  spf.debug.info('spf.history.add: ', 'url=', opt_url, 'state=', opt_state);
  this.push_(false, opt_url, opt_state, opt_skipCallback);
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
 * @param {boolean=} opt_skipCallback Whether to skip calling the callback.
 * @throws {Error} If the state object is too large. For example, Firefox will
 *     pass the object to JSON.stringify and impose a 640k character limit.
 * @throws {Error} If the URL is not in the same domain, a SECURITY_ERR
 *     (code == 18) is thrown.
 */
spf.history.Monitor.prototype.replace = function(opt_url, opt_state,
                                                 opt_skipCallback) {
  spf.debug.info('spf.history.replace: ', 'url=', opt_url, 'state=', opt_state);
  this.push_(true, opt_url, opt_state, opt_skipCallback);
};


/**
 * See {@link #add} or {@link #replace}.
 *
 * @param {boolean} replace Whether to replace the previous entry.
 * @param {?string=} opt_url The URL associated with this entry.
 * @param {Object=} opt_state The state object associated with this entry.
 * @param {boolean=} opt_skipCallback Whether to skip the callback.
 * @private
 */
spf.history.Monitor.prototype.push_ = function(replace, opt_url, opt_state,
                                               opt_skipCallback) {
  if (!opt_url && !opt_state) {
    return;
  }
  var url = opt_url || window.location.href;
  var state = opt_state || {};
  this.timestamp_ = spf.now();
  state['spf-timestamp'] = this.timestamp_;
  if (replace) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
  spf.debug.debug('entry:  ', 'url=', url, 'state=', state);
  this.url_ = url;
  if (!opt_skipCallback) {
    this.callback_(url, state);
  }
};
