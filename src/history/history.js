// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview Singleton history instance used to enable browser history
 * functions (e.g. back/forward) without leaving the current page.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.history');

goog.require('spf.history.Monitor');


/**
 * Initialize pushState-based HTML5 History management.
 * {@see spf.history.Monitor#enable}
 *
 * @param {function(string, Object=)} callback The function to handle
 *     a history event. The first parameter will be the URL
 *     the user is browsing to.  The second parameter will be an optional
 *     state object associated with that URL.
 */
spf.history.init = function(callback) {
  if (!spf.history.initialized_) {
    if (!spf.history.instance_) {
      spf.history.instance_ = new spf.history.Monitor(callback);
    }
    spf.history.instance_.enable(true);
    spf.history.initialized_ = true;
  }
};


/**
 * Dispose pushState-based HTML5 History management.
 * {@see spf.history.Monitor#disable}
 */
spf.history.dispose = function() {
  if (spf.history.initialized_) {
    spf.history.instance_.disable();
    spf.history.initialized_ = false;
  }
};


/**
 * Add a history entry.
 * {@see spf.history.Monitor#add}
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
spf.history.add = function(opt_url, opt_state, opt_skipCallback) {
  spf.history.instance_.add(opt_url, opt_state, opt_skipCallback);
};


/**
 * @type {boolean}
 * @private
 */
spf.history.initialized_ = false;


/**
 * @type {spf.history.Monitor}
 * @private
 */
spf.history.instance_;
