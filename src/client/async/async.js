// Copyright 2015 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Fast asynchronous function execution.
 *
 * This package provides functions to defer execution on the main thread
 * without using setTimeout, though setTimeout is used as a fallback in browsers
 * that do not support other methods.  Using these methods is advantageous when
 * one wants to schedule a callback faster than the setTimeout clamped minimum
 * allows (e.g. when doing `setTimeout(fn, 0)`)  The clamped minimum for
 * setTimeout is often 10ms, though when WebKit browsers are in a background
 * tab, setTimeout calls deprioritized to execute with a 1s delay.  In these
 * cases, this package provides an alternative.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.async');

goog.require('spf');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tracing');


/**
 * Defers execution of a function to the next slot on the main thread.
 *
 * @param {!Function} fn The function to defer.
 */
spf.async.defer = function(fn) {
  var uid = spf.uid();
  spf.async.defers_[uid] = fn;
  if (spf.async.POSTMESSAGE_SUPPORTED_) {
    window.postMessage(spf.async.PREFIX_ + uid, '*');
  } else {
    window.setTimeout(spf.bind(spf.async.run_, null, uid), 0);
  }
};


/**
 * Handles a message event and triggers execution function.
 *
 * @param {Event} evt The click event.
 * @private
 */
spf.async.handleMessage_ = function(evt) {
  if (evt.data && spf.string.isString(evt.data) &&
      spf.string.startsWith(evt.data, spf.async.PREFIX_)) {
    var uid = evt.data.substring(spf.async.PREFIX_.length);
    spf.async.run_(uid);
  }
};


/**
 * Executes a previously deferred function.
 *
 * @param {string|number} uid The UID associated with the function.
 * @private
 */
spf.async.run_ = function(uid) {
  var fn = spf.async.defers_[uid];
  if (fn) {
    delete spf.async.defers_[uid];
    fn();
  }
};


/**
 * Adds a function as a listener for message events.
 *
 * @param {!Function} fn The function to add as a listener.
 * @private
 */
spf.async.addListener_ = function(fn) {
  if (window.addEventListener) {
    window.addEventListener('message', fn, false);
  } else if (window.attachEvent) {
    window.attachEvent('onmessage', fn);
  }
};


/**
 * Removes a function as a listener for message events.
 *
 * @param {!Function} fn The function to remove as a listener.
 * @private
 */
spf.async.removeListener_ = function(fn) {
  if (window.removeEventListener) {
    window.removeEventListener('message', fn, false);
  } else if (window.detachEvent) {
    window.detachEvent('onmessage', fn);
  }
};


/**
 * Whether the browser supports asynchronous postMessage calls.
 *
 * @private {boolean}
 */
spf.async.POSTMESSAGE_SUPPORTED_ = (function() {
  if (!window.postMessage) {
    return false;
  }
  // Use postMessage where available.  But, ensure that postMessage is
  // asynchronous; the implementation in IE8 is synchronous, which defeats
  // the purpose.  To detect this, use a temporary "onmessage" listener.
  var supported = true;
  var listener = function() { supported = false; };
  // Add the listener, dispatch a message event, and remove the listener.
  spf.async.addListener_(listener);
  window.postMessage('', '*');
  spf.async.removeListener_(listener);
  // Return the status.  If the postMessage implementation is correctly
  // asynchronous, then the value of the `supported` variable will be
  // true, but if the postMessage implementation is synchronous, the
  // temporary listener will have executed and set the `supported`
  // variable to false.
  return supported;
})();


/**
 * The prefix to use for message event data to avoid conflicts.
 *
 * @private {string}
 */
spf.async.PREFIX_ = 'spf:';


/**
 * Map of deferred function calls.
 * @private {!Object.<!Function>}
 */
spf.async.defers_ = {};


// Automatic initialization for spf.async.defers_.
// When built for the bootloader, unconditionally set in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.ASYNC_DEFERS, spf.async.defers_);
} else {
  if (!spf.state.has(spf.state.Key.ASYNC_DEFERS)) {
    spf.state.set(spf.state.Key.ASYNC_DEFERS, spf.async.defers_);
  }
  spf.async.defers_ = /** @type {!Object.<!Function>} */ (
      spf.state.get(spf.state.Key.ASYNC_DEFERS));
}

// Automatic initialization for spf.state.Key.ASYNC_LISTENER.
// When built for the bootloader, unconditionally set in state.
if (SPF_BOOTLOADER) {
  if (spf.async.POSTMESSAGE_SUPPORTED_) {
    spf.async.addListener_(spf.async.handleMessage_);
    spf.state.set(spf.state.Key.ASYNC_LISTENER, spf.async.handleMessage_);
  }
} else {
  if (spf.async.POSTMESSAGE_SUPPORTED_) {
    if (spf.state.has(spf.state.Key.ASYNC_LISTENER)) {
      spf.async.removeListener_(/** @type {function(Event)} */ (
          spf.state.get(spf.state.Key.ASYNC_LISTENER)));
    }
    spf.async.addListener_(spf.async.handleMessage_);
    spf.state.set(spf.state.Key.ASYNC_LISTENER, spf.async.handleMessage_);
  }
}


if (spf.tracing.ENABLED) {
  (function() {
    spf.async.defer = spf.tracing.instrument(
        spf.async.defer, 'spf.async.defer');
  })();
}
