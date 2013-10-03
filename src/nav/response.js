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
 * Processes a SPF response using the SPF protocol.
 *
 * @param {spf.SingleResponse} response The SPF response object to process.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 * @param {boolean=} opt_notify Whether to execute the global notification
 *     callback if processing succeeds.
 */
spf.nav.response.process = function(response, opt_reverse, opt_notify) {
  spf.debug.info('nav.response.process ', response, opt_reverse);
  var timing = response['timing'] || (response['timing'] = {});
  // Install page styles.
  var cssParseResult = spf.net.styles.parse(response['css']);
  spf.net.styles.install(cssParseResult);
  timing['spfProcessCss'] = spf.now();
  spf.debug.debug('    installed styles');
  // Update title.
  if (response['title']) {
    document.title = response['title'];
  }
  // Update attributes.
  var attributes = response['attr'] || {};
  for (var id in attributes) {
    var el = document.getElementById(id);
    if (!el) {
      continue;
    }
    spf.dom.setAttributes(el, attributes[id]);
    spf.debug.debug('    set attributes ', id);
  }
  timing['spfProcessAttr'] = spf.now();
  // Tally the number of content updates need.
  var remaining = 0;
  var fragments = response['html'] || {};
  if (Object.keys) {
    remaining = Object.keys(fragments).length;
  } else {
    for (var id in fragments) {
      remaining++;
    }
  }
  // Set up to execute scripts after the content loads.
  var maybeContinueAfterContent = function() {
    // Only execute when remaining is 0, to avoid early execution.
    if (remaining == 0) {
      timing['spfProcessHtml'] = spf.now();
      // Execute scripts.
      var jsParseResult = spf.net.scripts.parse(response['js']);
      spf.net.scripts.execute(jsParseResult, function() {
        timing['spfProcessJs'] = spf.now();
        spf.debug.debug('    executed scripts');
        if (opt_notify) {
          // Execute the "navigation processed" callback.  There is no
          // opportunity to cancel the navigation after processing is complete,
          // so explicitly returning false here does nothing.
          var val = spf.execute(/** @type {Function} */ (
              spf.config.get('navigate-processed-callback')), response);
          if (val instanceof Error) {
            spf.debug.warn('failed in "navigate-processed-callback", ignoring',
                           '(val=', val, ')');
          }
        }
      });
      // Prevent double execution.
      remaining--;
    }
  };
  // Update content.
  for (var id in fragments) {
    var el = document.getElementById(id);
    if (!el) {
      remaining--;
      continue;
    }
    var html = fragments[id];
    var key = spf.key(el);
    var transitionClass = /** @type {string} */ (
        spf.config.get('transition-class'));
    if (!spf.nav.response.CAN_ANIMATE_ ||
        !spf.dom.classlist.contains(el, transitionClass)) {
      var jsParseResult = spf.net.scripts.parse(html);
      // If the target element isn't enabled for transitions, just replace.
      // Use the parsed HTML without script tags to avoid any scripts
      // being accidentally considered loading.
      el.innerHTML = jsParseResult.html;
      spf.debug.debug('    updated fragment content ', id);
      // Execute embedded scripts before continuing.
      spf.net.scripts.execute(jsParseResult, function() {
        spf.debug.debug('    executed fragment scripts ', id);
        remaining--;
        maybeContinueAfterContent();
      });
    } else {
      // Otherwise, check for a previous transition before continuing.
      spf.nav.response.process_(key, true);
      // Define variables used throughout the transition steps.
      var queue = [];
      var data = {
        reverse: !!opt_reverse,
        jsParseResult: spf.net.scripts.parse(html),
        currentEl: null,  // Set in Step 1.
        pendingEl: null,  // Set in Step 1.
        parentEl: el,
        currentClass: transitionClass + '-old',
        pendingClass: transitionClass + '-new',
        startClass: !!opt_reverse ?
                        transitionClass + '-reverse-start' :
                        transitionClass + '-forward-start',
        endClass: !!opt_reverse ?
                      transitionClass + '-reverse-end' :
                      transitionClass + '-forward-end'
      };
      // Transition Step 1: Insert new (timeout = 0).
      queue.push([function(data, next) {
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
        next();
      }, 0]);
      // Transition Step 2: Switch between old and new (timeout = 0).
      queue.push([function(data, next) {
        // Start the transition.
        spf.dom.classlist.remove(data.parentEl, data.startClass);
        spf.dom.classlist.add(data.parentEl, data.endClass);
        next();
      }, 0]);
      // Transition Step 3: Remove old (timeout = config duration).
      queue.push([function(data, next) {
        spf.debug.debug('    updated fragment content ', data.parentEl.id);
        // When done, remove the old content.
        data.parentEl.removeChild(data.currentEl);
        // End the transition.
        spf.dom.classlist.remove(data.parentEl, data.endClass);
        // Reparent the new elements.
        spf.dom.flattenElement(data.pendingEl);
        next();
      }, spf.config.get('transition-duration')]);
      // Transition Step 4: Execute scripts (timeout = 0).
      queue.push([function(data, next) {
        // Execute embedded scripts before continuing.
        spf.net.scripts.execute(data.jsParseResult, function() {
          spf.debug.debug('    executed fragment scripts ', data.parentEl.id);
          remaining--;
          maybeContinueAfterContent();
          next();
        });
      }, 0]);
      // Store the steps so the transition can be cleared, if needed.
      var transitions = spf.nav.response.transitions_();
      transitions[key] = {'timer': 0, 'queue': queue, 'data': data};
      // Execute the steps in order.
      spf.nav.response.process_(key);
    }
  }
  // Attempt to continue, in case no content is returned.
  maybeContinueAfterContent();
};


/**
 * See {@link #process}.
 *
 * @param {string} key The transition key.
 * @param {boolean=} opt_quick Whether to quickly iterate through instead of
 *     using setTimeout to facilitate transitions.
 * @private
 */
spf.nav.response.process_ = function(key, opt_quick) {
  var transitions = spf.nav.response.transitions_();
  if (key in transitions) {
    if (transitions[key]['queue'].length > 0) {
      var step = transitions[key]['queue'].shift();
      if (opt_quick) {
        step[0](transitions[key]['data'], function() {
          spf.nav.response.process_(key, opt_quick);
        });
      } else {
        transitions[key]['timer'] = setTimeout(function() {
          step[0](transitions[key]['data'], function() {
            spf.nav.response.process_(key, opt_quick);
          });
        }, step[1]);
      }
    } else {
      clearTimeout(transitions[key]['timer'])
      delete transitions[key];
    }
  }
};


/**
 * Preprocesses the response using the SPF protocol.  The response object
 * should already have been unserialized by {@link #request}.  Similar to
 * {@link #process} but instead of page content being updated, script and
 * stylesheet URLs are prefetched.
 *
 * @param {spf.SingleResponse} response The SPF response object to preprocess.
 */
spf.nav.response.preprocess = function(response) {
  spf.debug.info('nav.response.preprocess ', response);
  // Preinstall page styles.
  var cssParseResult = spf.net.styles.parse(response['css']);
  spf.net.styles.preinstall(cssParseResult);
  spf.debug.debug('    preinstalled styles');
  // Preexecute fragment scripts.
  var fragments = response['html'] || {};
  var jsParseResult;
  for (var id in fragments) {
    jsParseResult = spf.net.scripts.parse(fragments[id]);
    spf.net.scripts.preexecute(jsParseResult);
    spf.debug.debug('    preexecuted fragment scripts ', id);
  }
  // Preexecute page scripts.
  jsParseResult = spf.net.scripts.parse(response['js']);
  spf.net.scripts.preexecute(jsParseResult);
  spf.debug.debug('    preexecuted scripts');
};


/**
 * Type definition for the transition map.
 * @typedef {!Object.<string, ?{timer: number, queue: !Array, data: !Object}>}
 */
spf.nav.response.TransitionMap;

/**
 * @param {spf.nav.response.TransitionMap=} opt_trans Optional map of
 *     transitions to overwrite the current value.
 * @return {spf.nav.response.TransitionMap} Current map of transitions.
 * @private
 */
spf.nav.response.transitions_ = function(opt_trans) {
  var trans;
  if (opt_trans || !spf.state.has('nav-transitions')) {
    trans = spf.state.set('nav-transitions', (opt_trans || {}));
  } else {
    trans = spf.state.get('nav-transitions');
  }
  return /** @type {spf.nav.response.TransitionMap} */ (trans);
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
  var prefixes = ['Webkit', 'Moz', 'Ms', 'O', 'Khtml'];
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
