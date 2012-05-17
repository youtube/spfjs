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
  // Ignore clicks with modifier keys.
  if (evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey) {
    spf.debug.warn('ignoring click with modifier key');
    return;
  }
  // Ignore clicks on targets without the SPF link class.
  var target = spf.dom.getAncestor(evt.target, function(node) {
    return spf.dom.classes.has(node, spf.config['link-class']);
  });
  if (!target) {
    return;
  }
  // Ignore clicks to the same page.
  var url = target.href;
  if (url == window.location.href) {
    // Prevent the default browser navigation to avoid hard refreshes.
    evt.preventDefault();
    return;
  }
  // Publish to callbacks.
  spf.pubsub.publish('callback-click', target);
  try {
    // Add the URL to the history stack, (calls back to handleNavigate).
    spf.history.add(url);
    // Prevent the default browser navigation.
    evt.preventDefault();
  } catch (err) {
    // A SECURITY_ERR exception is thrown if the URL passed to pushState
    // doesn't match the same domain.  In this case, do nothing to allow
    // the default browser navigation to take effect.
    spf.debug.error('>> error caught, ignoring click', err);
  }
};


/**
 * Handles callbacks when the active history entry changes.
 *
 * @param {string} url The URL the user is browsing to.
 * @param {Object=} opt_state An optional state object associated with the URL.
 */
spf.nav.handleHistory = function(url, opt_state) {
  var reverse = !!(opt_state && opt_state['spf-back']);
  spf.debug.info('nav.handleNavigate: ', 'url=', url, 'state=', opt_state);
  // Publish to callbacks.
  spf.pubsub.publish('callback-history', url);
  // Navigate to the URL.
  spf.nav.navigate(url, reverse);
};


/**
 * Navigates to a URL using the SPF protocol.  First, the content is requested
 * by {@link #request}.  If the reponse is sucessfully parsed, it is processed
 * by {@link #process}.  If not, the browser is redirected to the URL. Only a
 * single navigation request can be in flight at once.  If a second URL is
 * navigated to while a first is still pending, the first will be cancelled.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 */
spf.nav.navigate = function(url, opt_reverse) {
  spf.debug.info('nav.navigate', url, opt_reverse);
  if (!spf.nav.initialized_) {
    spf.debug.error('>> nav not initialized');
    return;
  }
  if (spf.nav.request_) {
    spf.debug.warn('    >> aborting previous navigate', spf.nav.request_);
    spf.nav.request_.abort();
    spf.nav.request_ = null;
  }
  var navigateError = function(url) {
    spf.nav.request_ = null;
    window.location.href = url;
  };
  var navigateSuccess = function(url, response) {
    spf.nav.request_ = null;
    // Process the requested response.
    spf.nav.process(response, opt_reverse);
  };
  var xhr = spf.nav.request(url, navigateSuccess, navigateError);
  spf.nav.request_ = xhr;
};


/**
 * Loads a URL using the SPF protocol.  Similar to {@link #navigate}, but
 * intended for traditional content updates, not page navigation.  Not subject
 * to restrictions on the number of simultaneous requests.  The content is
 * requested by {@link #request}.  If the response is successfully parsed, it
 * is processed by {@link #process}, and the URL and response object are passed
 * to the optional {@code opt_onSuccess} callback.  If not, the URL is passed
 * to the optional {@code opt_onError} callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the load succeeds.
 * @param {function(string)=} opt_onError The callback to execute if the
 *     load fails.
 */
spf.nav.load = function(url, opt_onSuccess, opt_onError) {
  spf.debug.info('nav.load', url);
  var loadError = function(url) {
    if (opt_onError) {
      opt_onError(url);
    }
  };
  var loadSuccess = function(url, response) {
    // Process the requested response.
    spf.nav.process(response);
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  }
  spf.nav.request(url, loadSuccess, loadError);
};


/**
 * Requests a URL using the SPF protocol and parses the response.  If
 * successful, the URL and response object are passed to the optional
 * {@code opt_onSuccess} callback.  If not, the URL is passed to the optional
 * {@code opt_onError} callback.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the request succeeds.
 * @param {function(string)=} opt_onError The callback to execute if the
 *     request fails.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.request = function(url, opt_onSuccess, opt_onError) {
  spf.debug.info('nav.request', url);
  var requestUrl = url;
  var ident = spf.config['url-identifier'];
  if (!spf.string.contains(requestUrl, ident)) {
    if (spf.string.startsWith(ident, '?')) {
      if (!spf.string.contains(requestUrl, '?')) {
        requestUrl += ident;
      } else {
        requestUrl += ident.replace('?', '&');
      }
    }
  }
  var requestError = function(xhr) {
    if (opt_onError) {
      opt_onError(url);
    }
  };
  var requestSuccess = function(xhr) {
    try {
      if ('JSON' in window) {
        var response = JSON.parse(xhr.responseText);
      } else {
        var response = eval('(' + xhr.responseText + ')');
      }
    } catch (err) {
      requestError(xhr);
      return;
    }
    response = /** @type {spf.nav.Response} */ (response);
    // Publish to callbacks.
    spf.pubsub.publish('callback-request', url, response);
    if (opt_onSuccess) {
      opt_onSuccess(url, response);
    }
  };
  var xhr = spf.net.xhr.get(requestUrl, {
    timeoutMs: spf.config['request-timeout'],
    onSuccess: requestSuccess,
    onError: requestError,
    onTimeout: requestError
  });
  return xhr;
};


/**
 * Process the response using the SPF protocol.  The response object should
 * already have been unserialized by {@link #request}.
 *
 * @param {spf.nav.Response} response The SPF response object to load.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 */
spf.nav.process = function(response, opt_reverse) {
  spf.debug.info('nav.process', response, opt_reverse);
  // Install page styles.
  spf.net.styles.install(response['css']);
  // Update title.
  if (response['title']) {
    document.title = response['title'];
  }
  // Tally the number of content updates need.
  var remaining = 0;
  var html = response['html'] || {};
  if (Object.keys) {
    remaining = Object.keys(html).length;
  } else {
    for (var id in html) {
      remaining++;
    }
  }
  // Set up to execute scripts after the content loads.
  var maybeExecutePageScripts = function() {
      // Only execute when remaining is 0, to avoid early execution.
    if (remaining == 0) {
      spf.net.scripts.execute(response['js'], function() {
        // Publish to callbacks.
        spf.pubsub.publish('callback-process', response);
      });
      // Prevent double execution.
      remaining--;
    }
  };
  // Update content.
  for (var id in html) {
    var content = document.getElementById(id);
    if (!content) {
      continue;
    }
    var key = spf.getKey(content);
    if (!spf.nav.animate_ ||
        !spf.dom.classes.has(content, spf.config['transition-class'])) {
      // If the target element isn't enabled for transitions, just replace.
      content.innerHTML = response['html'][id];
      // Execute embedded scripts before continuing.
      spf.net.scripts.execute(response['html'][id], function() {
        remaining--;
        maybeExecutePageScripts();
      });
    } else {
      // Otherwise, check for a previous transition before continuing.
      spf.nav.process_(key, true);
      // Define variables used throughout the transition steps.
      var queue = [];
      var data = {};
      data.reverse = !!opt_reverse;
      data.parentEl = content;
      data.currentClass = spf.config['transition-current-child-class'];
      if (data.reverse) {
        data.pendingClass = spf.config['transition-reverse-child-class'];
        data.parentClass = spf.config['transition-reverse-parent-class'];
      } else {
        data.pendingClass = spf.config['transition-forward-child-class'];
        data.parentClass = spf.config['transition-forward-parent-class'];
      }
      // Transition Step 1: Insert new (timeout = 0).
      queue.push([function(data, next) {
        // Reparent the existing elements.
        data.currentEl = document.createElement('div');
        data.currentEl.className = data.currentClass;
        spf.dom.inflateElement(data.parentEl, data.currentEl);
        // Add the new content.
        data.pendingEl = document.createElement('div');
        data.pendingEl.className = data.pendingClass;
        data.pendingEl.innerHTML = response['html'][data.parentEl.id];
        if (data.reverse) {
          spf.dom.insertSiblingBefore(data.pendingEl, data.currentEl);
        } else {
          spf.dom.insertSiblingAfter(data.pendingEl, data.currentEl);
        }
        next();
      }, 0]);
      // Transition Step 2: Switch between old and new (timeout = 0).
      queue.push([function(data, next) {
        spf.dom.classes.add(data.parentEl, data.parentClass);
        next();
      }, 0]);
      // Transition Step 3: Remove old (timeout = config duration).
      queue.push([function(data, next) {
        // When done, remove the old content.
        data.parentEl.removeChild(data.currentEl);
        // End the transition.
        spf.dom.classes.remove(data.parentEl, data.parentClass);
        // Reparent the new elements.
        spf.dom.flattenElement(data.pendingEl);
        next();
      }, spf.config['transition-duration']]);
      // Transition Step 4: Execute scripts (timeout = 0).
      queue.push([function(data, next) {
        // Execute embedded scripts before continuing.
        spf.net.scripts.execute(response['html'][data.parentEl.id], function() {
          remaining--;
          maybeExecutePageScripts();
          next();
        });
      }, 0]);
      // Store the steps so the transition can be cleared, if needed.
      spf.nav.transitions_[key] = {timer: 0, queue: queue, data: data};
      // Execute the steps in order.
      spf.nav.process_(key);
    }
  }
  // Attempt to execute page scripts, in case no content is returned.
  maybeExecutePageScripts();
};


/**
 * See {@link #process}.
 *
 * @param {string} key The transition key.
 * @private
 */
spf.nav.process_ = function(key, opt_quick) {
  var transitions = spf.nav.transitions_;
  if (key in transitions) {
    if (transitions[key].queue.length > 0) {
      var step = transitions[key].queue.shift();
      if (opt_quick) {
        step[0](transitions[key].data, function() {
          spf.nav.process_(key, opt_quick);
        });
      } else {
        transitions[key].timer = setTimeout(function() {
          step[0](transitions[key].data, function() {
            spf.nav.process_(key, opt_quick);
          });
        }, step[1]);
      }
    } else {
      clearTimeout(transitions[key].timer)
      delete transitions[key];
    }
  }
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
spf.nav.request_;


/**
 * @type {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>}
 * @private
 */
spf.nav.transitions_ = {};


/**
 * Whether the browser supports animation via CSS Transitions.
 * @type {boolean}
 * @private
 */
spf.nav.animate_ = (function() {
  var testEl = document.createElement('div');
  var prefixes = ['WebKit', 'Moz', 'Ms', 'O', 'Khtml'];
  for (var i = 0, l = prefixes.length; i < l; i++) {
    if (prefixes[i] + 'Transition' in testEl.style) {
      return true;
    }
  };
  return false;
})();
