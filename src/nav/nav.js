// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview Functions to handle pushState-based navigation.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


goog.provide('spf.nav');

goog.require('spf');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classes');
goog.require('spf.history');
goog.require('spf.net.scripts');
goog.require('spf.net.styles');
goog.require('spf.net.xhr');
goog.require('spf.pubsub');
goog.require('spf.string');


/**
 * Type definition for a SPF response object.
 * - css: HTML string containing <link> and <style> tags of CSS to install.
 * - html: Map of Element IDs and HTML strings containing content with which
 *      to update the Elements.
 * - js: HTML string containing <script> tags of JS to execute.
 * - title: String of the new Document title.
 *
 * @typedef {{
 *   css: (string|undefined),
 *   html: (Object.<string, string>|undefined),
 *   js: (string|undefined),
 *   title: (string|undefined)
 * }}
 */
spf.nav.Response;


/**
 * Initializes (enables) pushState navigation.
 */
spf.nav.init = function() {
  if (!spf.nav.initialized_) {
    document.addEventListener('click', spf.nav.handleClick, false);
    spf.nav.initialized_ = true;
  }
};


/**
 * Disposes (disables) pushState navigation.
 */
spf.nav.dispose = function() {
  if (spf.nav.initialized_) {
    document.removeEventListener('click', spf.nav.handleClick, false);
    spf.nav.initialized_ = false;
  }
};


/**
 * Handles page clicks on SPF links and adds pushState history entries for them.
 *
 * @param {Event} evt The click event.
 */
spf.nav.handleClick = function(evt) {
  spf.debug.info('nav.handleClick', evt);
  // TODO(nicksay): Update click handling to support children
  // TODO(nicksay): Update click handling to support fragment links
  // TODO(nicksay): Update click handling to support modifier keys
  if (evt.target && spf.dom.classes.has(evt.target, spf.config['link-class'])) {
    var url = evt.target.href;
    // Ignore clicks to the same page.
    if (url == window.location.href) {
      // Prevent the default browser navigation.
      evt.preventDefault();
      return;
    }
    // Publish to callbacks.
    spf.pubsub.publish('callback-click', evt.target);
    try {
      // Add the URL to the history stack, (calls back to handleNavigate).
      spf.history.add(url);
      // Prevent the default browser navigation.
      evt.preventDefault();
    } catch (err) {
      // A SECURITY_ERR exception is thrown if the URL passed to pushState
      // doesn't match the same domain.  In this case, do nothing to allow
      // the default browser navigation to take effect.
      spf.debug.error('    >> error caught, ignoring click', err);
    }
  }
};


/**
 * Handles navigation callbacks when the active history entry changes.
 *
 * @param {string} url The URL the user is browsing to.
 * @param {Object=} opt_state An optional state object associated with the URL.
 */
spf.nav.handleNavigate = function(url, opt_state) {
  var reverse = !!(opt_state && opt_state['spf-back']);
  spf.debug.info('nav.handleNavigate: ', 'url=', url, 'state=', opt_state);
  // Publish to callbacks.
  spf.pubsub.publish('callback-navigate', url);
  // Make the request for the URL.
  spf.nav.request(url, reverse);
};


/**
 * Requests a URL using the SPF protocol.  The content returned by successful
 * requests will be loaded by {@link #load}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 */
spf.nav.request = function(url, opt_reverse) {
  spf.debug.info('nav.request', url, opt_reverse);
  if (spf.nav.activeRequest_) {
    spf.debug.warn('    >> aborting previous request', spf.nav.activeRequest_);
    spf.nav.activeRequest_.abort();
    spf.nav.activeRequest_ = null;
  }
  var xhrUrl = url;
  var ident = spf.config['url-identifier'];
  if (!spf.string.contains(xhrUrl, ident)) {
    if (spf.string.startsWith(ident, '?')) {
      if (!spf.string.contains(xhrUrl, '?')) {
        xhrUrl += ident;
      } else {
        xhrUrl += ident.replace('?', '&');
      }
    }
  }
  var onError = function(xhr) {
    spf.nav.activeRequest_ = null;
    window.location.href = url;
  };
  var onSuccess = function(xhr) {
    spf.nav.activeRequest_ = null;
      try {
        if (JSON) {
          var response = JSON.parse(xhr.responseText);
        } else {
          var response = eval('(' + xhr.responseText + ')');
        }
      } catch (err) {
        onError(xhr);
        return;
      }
      response = /** @type {spf.nav.Response} */ (response);
      // Publish to callbacks.
      spf.pubsub.publish('callback-request', url, response);
      // Load the requested response.
      spf.nav.load(response, url, opt_reverse);
  };
  spf.nav.activeRequest_ = spf.net.xhr.get(xhrUrl, {
    timeoutMs: spf.config['request-timeout'],
    onSuccess: onSuccess,
    onError: onError,
    onTimeout: onError
  });
};


/**
 * Loads the response using the SPF protocol.  The response object should
 * already have been unserialized by {@link #request}.
 *
 * @param {spf.nav.Response} response The SPF response object to load.
 * @param {string} url The URL for the response, without the SPF identifier.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 */
spf.nav.load = function(response, url, opt_reverse) {
  spf.debug.info('nav.load', response, url, opt_reverse);
  // If an existing transition is in progress, complete it immediately.
  if (spf.nav.activeTransition_) {
    spf.debug.warn('    >> clearing previous transition',
                   spf.nav.activeTransition_);
    while (spf.nav.activeTransition_.queue.length > 0) {
      var fn = spf.nav.activeTransition_.queue.shift();
      fn();
    }
    clearTimeout(spf.nav.activeTransition_.timer);
    spf.nav.activeTransition_ = null;
  }
  // Delay to allow the DOM to update, then begin the load.
  setTimeout(function() {
    var reverse = !!opt_reverse;
    // Install styles.
    spf.net.styles.install(response['css']);
    // Update title.
    if (response['title']) {
      document.title = response['title'];
    }
    // Update content.
    for (var id in response['html']) {
      var content = document.getElementById(id);
      if (!spf.dom.classes.has(content, spf.config['transition-class'])) {
        //  If the target element isn't enabled for transitions, just replace.
        content.innerHTML = response['html'][id];
      } else {
        var currentClass = spf.config['transition-current-child-class'];
        if (reverse) {
          var childClass = spf.config['transition-reverse-child-class'];
          var parentClass = spf.config['transition-reverse-parent-class'];
        } else {
          var childClass = spf.config['transition-forward-child-class'];
          var parentClass = spf.config['transition-forward-parent-class'];
        }
        var current, pending;
        spf.nav.activeTransition_ = {timer: 0, queue: []};
        var prepareTransition = function() {
          // Reparent the existing elements.
          current = document.createElement('div');
          current.className = currentClass;
          spf.dom.inflateElement(content, current);
          // Add the new content.
          pending = document.createElement('div');
          pending.className = childClass;
          pending.innerHTML = response['html'][id];
          if (reverse) {
            spf.dom.insertSiblingBefore(pending, current);
          } else {
            spf.dom.insertSiblingAfter(pending, current);
          }
        };
        var doTransition = function() {
          spf.dom.classes.add(content, parentClass);
        };
        var completeTransition = function() {
          // When done, remove the old content.
          content.removeChild(current);
          // End the transition.
          spf.dom.classes.remove(content, parentClass);
          // Reparent the new elements.
          spf.dom.flattenElement(pending);
        };
        spf.nav.activeTransition_.queue.push(prepareTransition);
        spf.nav.activeTransition_.queue.push(doTransition);
        spf.nav.activeTransition_.queue.push(completeTransition);
        var executeNextCall = function() {
          if (spf.nav.activeTransition_.queue.length > 0) {
            var fn = spf.nav.activeTransition_.queue.shift();
            fn();
          }
        };
        // Prepare the transition.
        executeNextCall();
        // Delay to allow the DOM to update, then do the transition.
        spf.nav.activeTransition_.timer = setTimeout(function() {
          executeNextCall();
          // Delay to allow the transition to complete, then clean up.
          spf.nav.activeTransition_.timer = setTimeout(function() {
            executeNextCall();
          }, spf.config['transition-duration']);
        }, 0);
      }
    }
    // Execute scripts
    spf.net.scripts.execute(response['js'], function() {
      // Publish to callbacks.
      spf.pubsub.publish('callback-load', url, response);
    });
  }, 0);
};


/**
 * @type {boolean}
 * @private
 */
spf.nav.initialized_ = false;


/**
 * @type {XMLHttpRequest}
 * @private
 */
spf.nav.activeRequest_;


/**
 * @type {?{timer: number, queue: !Array}}
 * @private
 */
spf.nav.activeTransition_;
