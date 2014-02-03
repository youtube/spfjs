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
goog.require('spf.net.scripts');
goog.require('spf.net.styles');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tasks');
goog.require('spf.url');


/**
 * Parses text for an SPF response.  If {@code opt_multipart} is true, attempts
 * to parse the text for one or more (in)complete multipart SPF responses.
 *
 * @param {string} text Text to parse.
 * @param {boolean=} opt_multipart Whether to attempt to parse the text for
 *     one or more multipart SPF response sections.
 * @param {boolean=} opt_lastDitch Whether to parse the text as the final
 *     one, potentially handling malformed but valid responses.  Requires
 *     {@code opt_multipart} to be true.
 * @throws {Error} If the {@code text} contains invalid JSON, or when
 *     {@code opt_multipart} is true, if a section of a multipart response
 *     contains invalid JSON.
 * @return {{parts: Array.<spf.SingleResponse>, extra: string}}
 */
spf.nav.response.parse = function(text, opt_multipart, opt_lastDitch) {
  if (opt_multipart) {
    var beginToken = spf.nav.response.Token.BEGIN;
    var delimToken = spf.nav.response.Token.DELIMITER;
    var endToken = spf.nav.response.Token.END;
    var lastDitchHalfToken = '\r\n';
    var parts = [];
    var chunk;
    var start = 0;
    // With a last-ditch effort, append the token CRLF chars to the text, which
    // might allow parsing the final section of a response that ends with a
    // closing bracket but not the CRLF required of a well-formed END token.
    // As a side-effect, this will also successfully parse a response section
    // that ends with a comma (because the CRLF will create a well-formed
    // DELIMITER token).  If the last character is not a comma or closing
    // bracket, this last-ditch effort will have no effect.
    if (opt_lastDitch) {
      text += lastDitchHalfToken;
    }
    var finish = text.indexOf(beginToken, start);
    if (finish > -1) {
      start = finish + beginToken.length;
    }
    while ((finish = text.indexOf(delimToken, start)) > -1) {
      chunk = spf.string.trim(text.substring(start, finish));
      start = finish + delimToken.length;
      if (chunk) {
        parts.push(JSON.parse(chunk));
      }
    }
    finish = text.indexOf(endToken, start);
    if (finish > -1) {
      chunk = spf.string.trim(text.substring(start, finish));
      start = finish + endToken.length;
      if (chunk) {
        parts.push(JSON.parse(chunk));
      }
    }
    var extra = '';
    if (text.length > start) {
      extra = text.substring(start);
      if (opt_lastDitch && spf.string.endsWith(extra, lastDitchHalfToken)) {
        extra = extra.substring(0, extra.length - lastDitchHalfToken.length);
      }
    }
    return {
      parts: /** @type {Array.<spf.SingleResponse>} */(parts),
      extra: extra
    };
  } else {
    var response = JSON.parse(text);
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
  var key = 'process ' + spf.url.absolute(url);
  var sync = !spf.config.get('process-async');

  // NOTE: when adding tasks to a queue, use bind to avoid name/scope errors.
  var fn;
  var num = 0;

  // Initialize the timing object if needed.
  if (!response['timing']) {
    response['timing'] = {};
  }

  // Update title (immediate).
  if (response['title']) {
    document.title = response['title'];
  }

  // Install page styles (single task), if needed.
  if (response['css']) {
    fn = spf.bind(function(css, timing) {
      spf.net.styles.install(spf.net.styles.parse(css));
      timing['spfProcessCss'] = spf.now();
      spf.debug.debug('  process task done: css');
    }, null, response['css'], response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: css', num);
  }

  // Update attributes (single task), if needed.
  if (response['attr']) {
    fn = spf.bind(function(attrs, timing) {
      for (var id in attrs) {
        var el = document.getElementById(id);
        if (el) {
          spf.dom.setAttributes(el, attrs[id]);
          spf.debug.debug('    attr set', id);
        }
      }
      timing['spfProcessAttr'] = spf.now();
      spf.debug.debug('  process task done: attr');
    }, null, response['attr'], response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: attr', num);
  }

  // Update content (one task per fragment or three tasks if animated).
  var fragments = response['html'] || {};
  var numBeforeFragments = num;
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
          spf.debug.debug('    html update', id);
          // Install embedded scripts before continuing.
          // Suspend main queue to allow JS execution to occur sequentially
          // before the page scripts are executed.
          // TODO(nicksay): Consider disallowing html-level scripts or
          //     using a sub-queue for JS execution.
          spf.tasks.suspend(key);
          spf.net.scripts.install(jsParseResult, function() {
            spf.debug.debug('    html js', id);
            spf.tasks.resume(key, sync);  // Resume main queue after JS.
            spf.debug.debug('  process task done: html', id);
          });
        } else {
          spf.tasks.suspend(key);  // Suspend main queue for animation.
          var animationKey = spf.tasks.key(el);
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
            spf.debug.debug('  process anim done: add new', data.parentEl.id);
          }, null, animationData);
          spf.tasks.add(animationKey, animationFn, 0);
          spf.debug.debug('  process anim queued: add new', id);
          // Animation task 2: switch between old and new (delay = 0).
          animationFn = spf.bind(function(data) {
            // Start the switch.
            spf.dom.classlist.remove(data.parentEl, data.startClass);
            spf.dom.classlist.add(data.parentEl, data.endClass);
            spf.debug.debug('  process anim done: swap', data.parentEl.id);
          }, null, animationData);
          spf.tasks.add(animationKey, animationFn, 0);
          spf.debug.debug('  process anim queued: swap', id);
          // Animation task 3: remove old (delay = config duration).
          animationFn = spf.bind(function(data) {
            // When done, remove the old content.
            data.parentEl.removeChild(data.currentEl);
            // End the switch.
            spf.dom.classlist.remove(data.parentEl, data.endClass);
            // Reparent the new elements.
            spf.dom.flattenElement(data.pendingEl);
            spf.debug.debug('    html update', data.parentEl.id);
            // Execute embedded scripts before continuing.
            spf.tasks.suspend(animationKey);  // Suspend sub-queue for JS.
            spf.net.scripts.install(data.jsParseResult, function() {
              spf.debug.debug('    html js', data.parentEl.id);
              spf.tasks.resume(animationKey);  // Resume sub-queue after JS.
              spf.debug.debug('  process anim done: del old', data.parentEl.id);
            });
          }, null, animationData);
          spf.tasks.add(animationKey, animationFn,
                        parseInt(spf.config.get('animation-duration'), 10));
          spf.debug.debug('  process anim queued: del old', id);
          // Finish the animation and move on.
          animationFn = spf.bind(function(data, key) {
            spf.debug.debug('  process anim done: complete', data.parentEl.id);
            spf.tasks.resume(key);  // Resume main queue after animation.
            spf.debug.debug('  process task done: html ', data.parentEl.id);
          }, null, animationData, key);
          spf.tasks.add(animationKey, animationFn);
          spf.debug.debug('  process anim queued: complete', id);
          spf.tasks.run(animationKey);
        }
      }
    }, null, id, fragments[id], response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: html', id, num);
  }
  var numAfterFragments = num;
  var numFragments = numAfterFragments - numBeforeFragments;

  // Install page scripts (single task), if needed.
  if (response['js']) {
    fn = spf.bind(function(js, timing, numFragments) {
      // Use the page scripts task as a signal that the content is updated,
      // only recording the content completion time if fragments were processed.
      if (numFragments) {
        timing['spfProcessHtml'] = spf.now();
      }
      spf.tasks.suspend(key);  // Suspend main queue for JS.
      spf.net.scripts.install(spf.net.scripts.parse(js), function() {
        timing['spfProcessJs'] = spf.now();
        spf.debug.debug('  process task done: js');
        spf.tasks.resume(key, sync);  // Resume main queue after JS.
      });
    }, null, response['js'], response['timing'], numFragments);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: js', num);
  } else if (numFragments) {
    // If a page scripts task is unnecessary and fragments were processed,
    // add a task to record the completion time.  Doing this only if page
    // scripts won't be installed prevents unnecessary task execution and
    // potential delays.
    fn = spf.bind(function(timing) {
      timing['spfProcessHtml'] = spf.now();
      spf.debug.debug('  process task done: timing-for-html');
    }, null, response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: timing-for-html', num);
  }

  // Execute callback.
  if (opt_callback) {
    num = spf.tasks.add(key, spf.bind(opt_callback, null, url, response));
    spf.debug.debug('  process task queued: callback', num);
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
  var key = 'preprocess ' + spf.url.absolute(url);

  // NOTE: when adding tasks to a queue, use bind to avoid name/scope errors.
  var fn;

  // Preinstall page styles (single task), if needed.
  if (response['css']) {
    fn = spf.bind(function(css) {
      spf.net.styles.preinstall(spf.net.styles.parse(css));
      spf.debug.debug('  preprocess task done: css');
    }, null, response['css']);
    spf.tasks.add(key, fn);
    spf.debug.debug('  preprocess task queued: css');
  }

  // Preinstall fragment scripts (one task per fragment).
  var fragments = response['html'] || {};
  for (var id in fragments) {
    if (fragments[id]) {
      fn = spf.bind(function(id, html) {
        // NOTE: Suspending the queue is not needed since the JS is not
        // actually executed and other tasks don't have to wait.
        spf.net.scripts.preinstall(spf.net.scripts.parse(html));
        spf.debug.debug('    html js', id);
        spf.debug.debug('  preprocess task done: html', id);
      }, null, id, fragments[id]);
      spf.tasks.add(key, fn);
      spf.debug.debug('  preprocess task queued: html', id);
    }
  }

  // Preinstall page scripts (single task).
  if (response['js']) {
    fn = spf.bind(function(js) {
      // NOTE: Suspending the queue is not needed since the JS is not
      // actually executed and other tasks don't have to wait.
      spf.net.scripts.preinstall(spf.net.scripts.parse(js));
      spf.debug.debug('  preprocess task done: js');
    }, null, response['js']);
    spf.tasks.add(key, fn);
    spf.debug.debug('  preprocess task queued: js');
  }

  // Execute callback.
  if (opt_callback) {
    spf.tasks.add(key, spf.bind(opt_callback, null, url, response));
    spf.debug.debug('  preprocess task queued: callback');
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
