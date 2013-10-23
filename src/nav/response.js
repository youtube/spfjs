/**
 * @fileoverview Navigation-related response functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.nav.response');

goog.require('spf');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.nav.url');
goog.require('spf.net.scripts');
goog.require('spf.net.styles');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tasks');


/**
 * Parses text for an SPF response.  If {@code opt_multipart} is true, attempts
 * to parse the text for one or more (in)complete multipart SPF responses.
 *
 * @param {string} text Text to parse.
 * @param {boolean=} opt_multipart Whether to attempt to parse the text for
 *     one or more multipart SPF response sections.
 * @throws {Error} If the {@code text} contains invalid JSON.
 * @return {{parts: Array.<spf.SingleResponse>, extra: string}}
 */
spf.nav.response.parse = function(text, opt_multipart) {
  if (opt_multipart) {
    var beginToken = spf.nav.response.Token.BEGIN;
    var delimToken = spf.nav.response.Token.DELIMITER;
    var endToken = spf.nav.response.Token.END;
    var parts = [];
    var chunk;
    var start = 0;
    var finish = text.indexOf(beginToken, start);
    if (finish > -1) {
      start = finish + beginToken.length;
    }
    while ((finish = text.indexOf(delimToken, start)) > -1) {
      chunk = spf.string.trim(text.substring(start, finish));
      start = finish + delimToken.length;
      if (chunk) {
        parts.push(spf.nav.response.parse_(chunk));
      }
    }
    finish = text.indexOf(endToken, start);
    if (finish > -1) {
      chunk = spf.string.trim(text.substring(start, finish));
      start = finish + endToken.length;
      if (chunk) {
        parts.push(spf.nav.response.parse_(chunk));
      }
    }
    var extra = '';
    if (text.length > start) {
      extra = text.substring(start);
    }
    return {
      parts: /** @type {Array.<spf.SingleResponse>} */(parts),
      extra: extra
    };
  } else {
    var response = spf.nav.response.parse_(text);
    var parts;
    if (typeof response.length == 'number') {
      parts = response;
    } else {
      parts = [response];
    }
    return {
      parts: /** @type {Array.<spf.SingleResponse>} */(parts),
      extra: ''
    };
  }
};


/**
 * See {@link #parse}.
 *
 * @param {string} text JSON response text to parse.
 * @throws {Error} If the {@code text} is invalid JSON.
 * @return {*}
 * @private
 */
spf.nav.response.parse_ = (function() {
  if ('JSON' in window) {
    return function(text) { return JSON.parse(text); };
  } else {
    return function(text) { return eval('(' + text + ')'); };
  }
})();


/**
 * Processes a SPF response.
 *
 * @param {string} url The URL of the response being processed.
 * @param {spf.SingleResponse} response The SPF response object to process.
 * @param {function(string, spf.SingleResponse)=} opt_callback Function to
 *     execute when processing is done; the first argument is {@code url},
 *     the second argument is {@code response}.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 */
spf.nav.response.process = function(url, response, opt_callback, opt_reverse) {
  spf.debug.info('nav.response.process ', response, opt_reverse);

  // Convert the URL to absolute, to be used for finding the task queue.
  var key = 'process ' + spf.nav.url.absolute(url);
  var sync = !spf.config.get('process-async');

  // NOTE: when adding tasks to a queue, use bind to avoid name/scope errors.
  var fn;

  // Initialize the timing object if needed.
  if (!response['timing']) {
    response['timing'] = {};
  }

  // Update title (immediate).
  if (response['title']) {
    document.title = response['title'];
  }

  // Install page styles (single task).
  fn = spf.bind(function(css, timing) {
    spf.net.styles.install(spf.net.styles.parse(css));
    spf.debug.debug('  installed styles');
    timing['spfProcessCss'] = spf.now();
  }, null, response['css'], response['timing']);
  spf.tasks.add(key, fn);

  // Update attributes (single task).
  fn = spf.bind(function(elementAttrs, timing) {
    for (var id in elementAttrs) {
      var el = document.getElementById(id);
      if (el) {
        spf.dom.setAttributes(el, elementAttrs[id]);
        spf.debug.debug('  set attributes ', id);
      }
    }
    timing['spfProcessAttr'] = spf.now();
  }, null, (response['attr'] || {}), response['timing']);
  spf.tasks.add(key, fn);

  // Update content (one task per fragment or three tasks if animated).
  var fragments = response['html'] || {};
  for (var id in fragments) {
    fn = spf.bind(function(id, html, timing) {
      var el = document.getElementById(id);
      if (el) {
        var jsParseResult = spf.net.scripts.parse(html);
        var animationClass = /** @type {string} */ (
            spf.config.get('animation-class'));
        var noAnimation = (!spf.nav.response.CAN_ANIMATE_ ||
                           !spf.dom.classlist.contains(el, animationClass));
        if (noAnimation) {
          // Use the parsed HTML without script tags to avoid any scripts
          // being accidentally considered loading.
          el.innerHTML = jsParseResult.html;
          spf.debug.debug('  updated fragment content ', id);
          // Install embedded scripts before continuing.
          spf.tasks.suspend(key);  // Suspend main queue for JS.
          spf.net.scripts.install(jsParseResult, function() {
            spf.debug.debug('  installed fragment scripts ', id);
            spf.tasks.resume(key, sync);  // Resume main queue after JS.
          });
        } else {
          spf.tasks.suspend(key);  // Suspend main queue for animation.
          var animationKey = spf.key(el);
          // Finish a previous animation on this sub-queue, if needed.
          spf.tasks.run(animationKey, true);
          var animationFn;
          var animationData = {
            jsParseResult: jsParseResult,
            reverse: !!opt_reverse,
            currentEl: null,  // Set in Step 1.
            pendingEl: null,  // Set in Step 1.
            parentEl: el,
            currentClass: animationClass + '-old',
            pendingClass: animationClass + '-new',
            startClass: !!opt_reverse ?
                            animationClass + '-reverse-start' :
                            animationClass + '-forward-start',
            endClass: !!opt_reverse ?
                          animationClass + '-reverse-end' :
                          animationClass + '-forward-end'
          };
          // Animation task 1: insert new (delay = 0).
          animationFn = spf.bind(function(data) {
            spf.dom.classlist.add(data.parentEl, data.startClass);
            // Reparent the existing elements.
            data.currentEl = document.createElement('div');
            data.currentEl.className = data.currentClass;
            spf.dom.inflateElement(data.parentEl, data.currentEl);
            // Add the new content.
            data.pendingEl = document.createElement('div');
            data.pendingEl.className = data.pendingClass;
            // Use the parsed HTML without script tags to avoid any scripts
            // being accidentally considered loading.
            data.pendingEl.innerHTML = data.jsParseResult.html;
            if (data.reverse) {
              spf.dom.insertSiblingBefore(data.pendingEl, data.currentEl);
            } else {
              spf.dom.insertSiblingAfter(data.pendingEl, data.currentEl);
            }
          }, null, animationData);
          spf.tasks.add(animationKey, animationFn, 0);
          // Animation task 2: switch between old and new (delay = 0).
          animationFn = spf.bind(function(data) {
            // Start the switch.
            spf.dom.classlist.remove(data.parentEl, data.startClass);
            spf.dom.classlist.add(data.parentEl, data.endClass);
          }, null, animationData);
          spf.tasks.add(animationKey, animationFn, 0);
          // Animation task 3: remove old (delay = config duration).
          animationFn = spf.bind(function(data) {
            spf.debug.debug('  updated fragment content ', data.parentEl.id);
            // When done, remove the old content.
            data.parentEl.removeChild(data.currentEl);
            // End the switch.
            spf.dom.classlist.remove(data.parentEl, data.endClass);
            // Reparent the new elements.
            spf.dom.flattenElement(data.pendingEl);
            // Execute embedded scripts before continuing.
            spf.tasks.suspend(animationKey);  // Suspend sub-queue for JS.
            spf.net.scripts.install(data.jsParseResult, function() {
              spf.debug.debug('  executed fragment scripts ', data.parentEl.id);
              spf.tasks.resume(animationKey);  // Resume sub-queue after JS.
            });
          }, null, animationData);
          spf.tasks.add(animationKey, animationFn,
                        parseInt(spf.config.get('animation-duration'), 10));
          // Finish the animation and move on.
          spf.tasks.add(animationKey, function() {
            spf.tasks.resume(key);  // Resume main queue after animation.
          });
          spf.tasks.run(animationKey);
        }
      }
    }, null, id, fragments[id], response['timing']);
    spf.tasks.add(key, fn);
  }
  fn = spf.bind(function(timing) {
    // TODO: consider tracking the last completion time instead of queuing.
    timing['spfProcessHtml'] = spf.now();
  }, null, response['timing']);
  spf.tasks.add(key, fn);

  // Install page scripts (single task).
  fn = spf.bind(function(js, timing) {
    spf.tasks.suspend(key);  // Suspend main queue for JS.
    spf.net.scripts.install(spf.net.scripts.parse(js), function() {
      spf.debug.debug('  installed scripts');
      timing['spfProcessJs'] = spf.now();
      spf.tasks.resume(key, sync);  // Resume main queue after JS.
    });
  }, null, response['js'], response['timing']);
  spf.tasks.add(key, fn);

  // Execute callback.
  if (opt_callback) {
    spf.tasks.add(key, spf.bind(opt_callback, null, url, response));
  }

  spf.tasks.run(key, sync);
};


/**
 * Preprocesses a SPF response.

 * Similar to {@link #process} but instead of page content being updated,
 * script and stylesheet URLs are prefetched.
 *
 * @param {string} url The URL of the response being preprocessed.
 * @param {spf.SingleResponse} response The SPF response object to preprocess.
 * @param {function(string, spf.SingleResponse)=} opt_callback Function to
 *     execute when preprocessing is done; the first argument is {@code url},
 *     the second argument is {@code response}.
 */
spf.nav.response.preprocess = function(url, response, opt_callback) {
  spf.debug.info('nav.response.preprocess ', response);
  // Convert the URL to absolute, to be used for finding the task queue.
  var key = 'preprocess ' + spf.nav.url.absolute(url);

  // NOTE: when adding tasks to a queue, use bind to avoid name/scope errors.
  var fn;

  // Preinstall page styles (single task).
  fn = spf.bind(function(css) {
    spf.net.styles.preinstall(spf.net.styles.parse(css));
    spf.debug.debug('  preinstalled styles');
  }, null, response['css']);
  spf.tasks.add(key, fn);

  // Preinstall fragment scripts (one task per fragment).
  var fragments = response['html'] || {};
  for (var id in fragments) {
    fn = spf.bind(function(id, html) {
      // NOTE: Suspending the queue is not needed since the JS is not
      // actually executed and other tasks don't have to wait.
      spf.net.scripts.preinstall(spf.net.scripts.parse(html));
      spf.debug.debug('  preinstalled fragment scripts ', id);
    }, null, id, fragments[id]);
    spf.tasks.add(key, fn);
  }

  // Preinstall page scripts (single task).
  fn = spf.bind(function(js) {
    // NOTE: Suspending the queue is not needed since the JS is not
    // actually executed and other tasks don't have to wait.
    spf.net.scripts.preinstall(spf.net.scripts.parse(js));
    spf.debug.debug('  preinstalled scripts');
  }, null, response['js']);
  spf.tasks.add(key, fn);

  // Execute callback.
  if (opt_callback) {
    spf.tasks.add(key, spf.bind(opt_callback, null, url, response));
  }

  // The preprocessing queue is always run async.
  spf.tasks.run(key);
};


/**
 * Whether the browser supports animation via CSS Transitions.
 * @private {boolean}
 */
spf.nav.response.CAN_ANIMATE_ = (function() {
  var testEl = document.createElement('div');
  if ('transition' in testEl.style) {
    return true;
  }
  var prefixes = ['webkit', 'Moz', 'Ms', 'O', 'Khtml'];
  for (var i = 0, l = prefixes.length; i < l; i++) {
    if (prefixes[i] + 'Transition' in testEl.style) {
      return true;
    }
  }
  return false;
})();


/**
 * Tokens used when parsing multipart responses.
 * @enum {string}
 */
spf.nav.response.Token = {
  BEGIN: '[\r\n',
  DELIMITER: ',\r\n',
  END: ']\r\n'
};
