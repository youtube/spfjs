// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Navigation-related response functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.nav.response');

goog.require('spf');
goog.require('spf.array');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.dom');
goog.require('spf.dom.classlist');
goog.require('spf.history');
goog.require('spf.net.script');
goog.require('spf.net.style');
goog.require('spf.string');
goog.require('spf.tasks');
goog.require('spf.tracing');
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
 * @param {boolean=} opt_navigate Whether this is a navigation request. Only
 *     navigation requests will process history changes.
 * @param {boolean=} opt_reverse Whether this is "backwards" navigation. True
 *     when the "back" button is clicked and a request is in response to a
 *     popState event.
 */
spf.nav.response.process = function(url, response, opt_callback, opt_navigate,
                                    opt_reverse) {
  spf.debug.info('nav.response.process ', response, opt_reverse);

  // Convert the URL to absolute, to be used for finding the task queue.
  var key = 'process ' + spf.url.absolute(url);
  var sync = !spf.config.get('experimental-process-async');

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

  // Add the new history state (immediate), if needed.
  if (opt_navigate && response['url']) {
    var fullUrl = spf.url.absolute(response['url']);
    // Update the history state if the url doesn't match.
    if (fullUrl != spf.nav.response.getCurrentUrl_()) {
      spf.debug.debug('  update history with response url');
      // Add the URL to the history stack, including hash.
      spf.history.replace(response['url'] + window.location.hash,
          null, false, true);
    }
  }

  // Install page styles (single task), if needed.
  // TODO(nicksay): Remove "css" key.
  if (response['head'] || response['css']) {
    fn = spf.bind(function(css, timing) {
      spf.nav.response.installStyles_(spf.nav.response.parseStyles_(css));
      timing['spfProcessCss'] = spf.now();
      spf.debug.debug('  process task done: css');
    }, null, (response['head'] || response['css']), response['timing']);
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
  // TODO(nicksay): Remove "html" key.
  var fragments = response['body'] || response['html'] || {};
  var numBeforeFragments = num;
  for (var id in fragments) {
    fn = spf.bind(function(id, html, timing) {
      var el = document.getElementById(id);
      if (el) {
        var jsParseResult = spf.nav.response.parseScripts_(html);
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
          spf.nav.response.installScripts_(jsParseResult, function() {
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
            spf.nav.response.installScripts_(data.jsParseResult, function() {
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
  if (response['foot'] || response['js']) {
    fn = spf.bind(function(js, timing, numFragments) {
      // Use the page scripts task as a signal that the content is updated,
      // only recording the content completion time if fragments were processed.
      if (numFragments) {
        timing['spfProcessHtml'] = spf.now();
      }
      spf.tasks.suspend(key);  // Suspend main queue for JS.
      spf.nav.response.installScripts_(
          spf.nav.response.parseScripts_(js),
          function() {
            timing['spfProcessJs'] = spf.now();
            spf.debug.debug('  process task done: js');
            spf.tasks.resume(key, sync);  // Resume main queue after JS.
          });
    }, null, (response['foot'] || response['js']), response['timing'],
        numFragments);
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
  if (response['head'] || response['css']) {
    fn = spf.bind(function(css) {
      spf.nav.response.preinstallStyles_(spf.nav.response.parseStyles_(css));
      spf.debug.debug('  preprocess task done: css');
    }, null, (response['head'] || response['css']));
    spf.tasks.add(key, fn);
    spf.debug.debug('  preprocess task queued: css');
  }

  // Preinstall fragment scripts (one task per fragment).
  // TODO(nicksay): Remove "html" key.
  var fragments = response['body'] || response['html'] || {};
  for (var id in fragments) {
    if (fragments[id]) {
      fn = spf.bind(function(id, html) {
        // NOTE: Suspending the queue is not needed since the JS is not
        // actually executed and other tasks don't have to wait.
        spf.nav.response.preinstallScripts_(
            spf.nav.response.parseScripts_(html));
        spf.debug.debug('    html js', id);
        spf.debug.debug('  preprocess task done: html', id);
      }, null, id, fragments[id]);
      spf.tasks.add(key, fn);
      spf.debug.debug('  preprocess task queued: html', id);
    }
  }

  // Preinstall page scripts (single task).
  if (response['foot'] || response['js']) {
    fn = spf.bind(function(js) {
      // NOTE: Suspending the queue is not needed since the JS is not
      // actually executed and other tasks don't have to wait.
      spf.nav.response.preinstallScripts_(spf.nav.response.parseScripts_(js));
      spf.debug.debug('  preprocess task done: js');
    }, null, (response['foot'] || response['js']));
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
 * Parses scripts from an HTML string.
 * See {@link #installScripts_}.
 *
 * @param {string|Object} html The HTML content to parse or the
 *     preparsed js object.
 * @return {!spf.nav.response.ParseScriptsResult_}
 * @private
 */
spf.nav.response.parseScripts_ = function(html) {
  var result = new spf.nav.response.ParseScriptsResult_();
  if (!html) {
    return result;
  }
  // If the html isn't a string, it is a preparsed object.
  if (!spf.string.isString(html)) {
    // Add the parsed scripts to the result object.
    if (html['scripts']) {
      spf.array.each(html['scripts'], function(script) {
        result.scripts.push({url: script['url'] || '',
                             text: script['text'] || '',
                             name: script['name'] || '',
                             async: script['async'] || false});
      });
    }
    result.html = html['html'] || '';
    return result;
  }
  html = html.replace(spf.nav.response.SCRIPT_TAG_REGEXP,
      function(fullMatch, attr, text) {
        var url = attr.match(spf.nav.response.SRC_ATTR_REGEXP);
        url = url ? url[1] : '';
        var name = attr.match(spf.nav.response.NAME_ATTR_REGEXP);
        name = name ? name[1] : '';
        var async = spf.nav.response.ASYNC_ATTR_REGEXP.test(attr);
        result.scripts.push({url: url, text: text, name: name, async: async});
        return '';
      });
  result.html = html;
  return result;
};


/**
 * Installs scripts that have been parsed from an HTML string.
 * See {@link spf.net.script.load}, {@link spf.net.script.eval}, and
 * {@link #parseScripts_}.
 *
 * @param {!spf.nav.response.ParseScriptsResult_} result The parsed HTML result.
 * @param {Function=} opt_callback Callback function to execute after
 *     all scripts are loaded.
 * @private
 */
spf.nav.response.installScripts_ = function(result, opt_callback) {
  if (result.scripts.length <= 0) {
    if (opt_callback) {
      opt_callback();
    }
    return;
  }
  // Load or evaluate the scripts in order or asynchronously.
  var index = -1;
  var getNextScript = function() {
    index++;
    if (index < result.scripts.length) {
      var item = result.scripts[index];
      if (item.url) {
        if (item.async) {
          spf.net.script.load(item.url, item.name);
          getNextScript();
        } else {
          spf.net.script.load(item.url, item.name, getNextScript);
        }
      } else if (item.text) {
        spf.net.script.eval(item.text, getNextScript);
      } else {
        getNextScript();
      }
    } else {
      if (opt_callback) {
        opt_callback();
      }
    }
  };
  getNextScript();
};


/**
 * Prefetches scripts that have been parsed from an HTML string.
 * See {@link spf.net.script.prefetch} and {@link #parseScripts_}.
 *
 * @param {!spf.nav.response.ParseScriptsResult_} result The parsed HTML result.
 * @private
 */
spf.nav.response.preinstallScripts_ = function(result) {
  if (result.scripts.length <= 0) {
    return;
  }
  // Prefetch the scripts.
  var urls = spf.array.map(result.scripts, function(item) {
    return item.url;
  });
  spf.net.script.prefetch(urls);
};


/**
 * Parses styles from an HTML string.
 *
 * @param {string|Object} html The HTML content to parse or the
 *     preparsed css object.
 * @return {!spf.nav.response.ParseStylesResult_}
 * @private
 */
spf.nav.response.parseStyles_ = function(html) {
  var result = new spf.nav.response.ParseStylesResult_();
  if (!html) {
    return result;
  }
  // If the html isn't a string, it is a preparsed object.
  if (!spf.string.isString(html)) {
    // Add the parsed styles to the result object.
    if (html['styles']) {
      spf.array.each(html['styles'], function(style) {
        result.styles.push({url: style['url'] || '',
                            text: style['text'] || '',
                            name: style['name'] || ''});
      });
    }
    result.html = html['html'] || '';
    return result;
  }
  html = html.replace(spf.nav.response.LINK_TAG_REGEXP,
      function(fullMatch, attr) {
        var isStyleSheet = spf.string.contains(attr, 'rel="stylesheet"');
        if (isStyleSheet) {
          var url = attr.match(spf.nav.response.HREF_ATTR_REGEXP);
          url = url ? url[1] : '';
          var name = attr.match(spf.nav.response.NAME_ATTR_REGEXP);
          name = name ? name[1] : '';
          result.styles.push({url: url, text: '', name: name});
          return '';
        } else {
          return fullMatch;
        }
      });
  html = html.replace(spf.nav.response.STYLE_TAG_REGEXP,
      function(fullMatch, attr, text) {
        result.styles.push({url: '', text: text, name: ''});
        return '';
      });
  result.html = html;
  return result;
};


/**
 * Installs styles that have been parsed from an HTML string.
 * See {@link spf.net.style.load}, {@link spf.net.style.eval}, and
 * {@link #parseStyles_}.
 *
 * @param {!spf.nav.response.ParseStylesResult_} result The parsed HTML result.
 * @private
 */
spf.nav.response.installStyles_ = function(result) {
  if (result.styles.length <= 0) {
    return;
  }
  // Install the styles.
  for (var i = 0, l = result.styles.length; i < l; i++) {
    var item = result.styles[i];
    if (item.url) {
      spf.net.style.load(item.url, item.name);
    } else if (item.text) {
      spf.net.style.eval(item.text);
    }
  }
};


/**
 * Prefetches styles that have been parsed from an HTML string.
 * See {@link spf.net.style.prefetch} and {@link #parseStyles_}.
 *
 * @param {!spf.nav.response.ParseStylesResult_} result The parsed HTML result.
 * @private
 */
spf.nav.response.preinstallStyles_ = function(result) {
  if (result.styles.length <= 0) {
    return;
  }
  // Prefetch the styles.
  var urls = spf.array.map(result.styles, function(item) {
    return item.url;
  });
  spf.net.style.prefetch(urls);
};


/**
 * Provides the current (absolute) URL from the window.
 * @return {string} Get the current window's URL.
 * @private
 */
spf.nav.response.getCurrentUrl_ = function() {
  return spf.url.absolute(window.location.href);
};


/**
 * A container for holding the result of parsing styles from an HTML string.
 * @constructor
 * @private
 */
spf.nav.response.ParseStylesResult_ = function() {
  /** @type {string} */
  this.html = '';
  /** @type {Array.<{url:string, text:string, name:string}>} */
  this.styles = [];
};



/**
 * A container for holding the result of parsing scripts from an HTML string.
 * @constructor
 * @private
 */
spf.nav.response.ParseScriptsResult_ = function() {
  /** @type {string} */
  this.html = '';
  /** @type {Array.<{url:string, text:string, name:string, async:boolean}>} */
  this.scripts = [];
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
 * Regular expression used to locate script tags in a string.
 * See {@link #parseScripts_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.SCRIPT_TAG_REGEXP =
    /\x3cscript([\s\S]*?)\x3e([\s\S]*?)\x3c\/script\x3e/ig;


/**
 * Regular expression used to locate style tags in a string.
 * See {@link #parseStyles_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.STYLE_TAG_REGEXP =
    /\x3cstyle([\s\S]*?)\x3e([\s\S]*?)\x3c\/style\x3e/ig;


/**
 * Regular expression used to locate link tags in a string.
 * See {@link #parseStyles_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.LINK_TAG_REGEXP = /\x3clink([\s\S]*?)\x3e/ig;


/**
 * Regular expression used to locate class attributes in a string.
 * See {@link #parseScripts_} and {@link #parseStyles_.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.CLASS_ATTR_REGEXP = /class="([\S]+)"/;


/**
 * Regular expression used to locate href attributes in a string.
 * See {@link #parseStyles_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.HREF_ATTR_REGEXP = /href="([\S]+)"/;


/**
 * Regular expression used to locate src attributes in a string.
 * See {@link #parseScripts_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.SRC_ATTR_REGEXP = /src="([\S]+)"/;


/**
 * Regular expression used to locate name attributes in a string.
 * See {@link #parseScripts_} and {@link #parseStyles_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.NAME_ATTR_REGEXP = /name="([\S]+)"/;


/**
 * Regular expression used to locate async attributes in a string. The presence
 * of async attribute represents true regardless the assigned value. To
 * represent false the async attribute has to be omitted altogether.
 * Reference: http://www.w3.org/TR/html5/infrastructure.html#boolean-attribute
 * See {@link #parseScripts_}.
 *
 * @type {RegExp}
 * @const
 */
spf.nav.response.ASYNC_ATTR_REGEXP = /(?:\s|^)async(?:\s|=|$)/i;


/**
 * Tokens used when parsing multipart responses.
 * @enum {string}
 */
spf.nav.response.Token = {
  BEGIN: '[\r\n',
  DELIMITER: ',\r\n',
  END: ']\r\n'
};


if (spf.tracing.ENABLED) {
  (function() {
    spf.nav.response.parse = spf.tracing.instrument(
        spf.nav.response.parse, 'spf.nav.response.parse');
    spf.nav.response.process = spf.tracing.instrument(
        spf.nav.response.process, 'spf.nav.response.process');
    spf.nav.response.preprocess = spf.tracing.instrument(
        spf.nav.response.preprocess, 'spf.nav.response.preprocess');

    spf.nav.response.parseScripts_ = spf.tracing.instrument(
        spf.nav.response.parseScripts_, 'spf.nav.response.parseScripts_');
    spf.nav.response.installScripts_ = spf.tracing.instrument(
        spf.nav.response.installScripts_,
        'spf.nav.response.installScripts_');
    spf.nav.response.preinstallScripts_ = spf.tracing.instrument(
        spf.nav.response.preinstallScripts_,
        'spf.nav.response.preinstallScripts_');

    spf.nav.response.parseStyles_ = spf.tracing.instrument(
        spf.nav.response.parseStyles_, 'spf.nav.response.parseStyles_');
    spf.nav.response.installStyles_ = spf.tracing.instrument(
        spf.nav.response.installStyles_, 'spf.nav.response.installStyles_');
    spf.nav.response.preinstallStyles_ = spf.tracing.instrument(
        spf.nav.response.preinstallStyles_,
        'spf.nav.response.preinstallStyles_');
  })();
}
