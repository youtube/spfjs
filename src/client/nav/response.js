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
goog.require('spf.net.connect');
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
  if (response['head']) {
    fn = spf.bind(function(head, timing) {
      // Extract scripts and styles from the fragment.
      var extracted = spf.nav.response.extract_(head);
      // Install links.
      spf.nav.response.installLinks_(extracted);
      // Install styles.
      spf.nav.response.installStyles_(extracted);
      spf.debug.debug('    head css');
      // Install scripts.
      // Suspend main queue to allow JS execution to occur sequentially.
      // TODO(nicksay): Consider using a sub-queue for JS execution.
      spf.tasks.suspend(key);
      spf.nav.response.installScripts_(extracted, function() {
        timing['spfProcessHead'] = spf.now();
        spf.debug.debug('    head js');
        spf.tasks.resume(key, sync);  // Resume main queue after JS.
        spf.debug.debug('  process task done: head');
      });
    }, null, response['head'], response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: head', num);
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
  var fragments = response['body'] || {};
  var numBeforeFragments = num;
  for (var id in fragments) {
    fn = spf.bind(function(id, body, timing) {
      var el = document.getElementById(id);
      if (el) {
        // Extract scripts and styles from the fragment.
        var extracted = spf.nav.response.extract_(body);
        var animationClass = /** @type {string} */ (
            spf.config.get('animation-class'));
        var noAnimation = (!spf.nav.response.CAN_ANIMATE_ ||
                           !spf.dom.classlist.contains(el, animationClass));
        if (noAnimation) {
          // Install styles.
          spf.nav.response.installStyles_(extracted);
          // Use the extracted HTML without scripts/styles to ensure they are
          // loaded properly.
          var installScripts = function() {
            // Install scripts.
            // Suspend main queue to allow JS execution to occur sequentially.
            // TODO(nicksay): Consider using a sub-queue for JS execution.
            spf.tasks.suspend(key);
            spf.nav.response.installScripts_(extracted, function() {
              spf.debug.debug('    body js', id);
              spf.tasks.resume(key, sync);  // Resume main queue after JS.
              spf.debug.debug('  process task done: body', id);
            });
          };
          var innerHtmlHandler = /** @type {Function} */(
              spf.config.get('experimental-html-handler'));
          if (innerHtmlHandler) {
            spf.tasks.suspend(key);  // Suspend for HTML handler.
            innerHtmlHandler(extracted.html, el, function() {
              installScripts();
              spf.tasks.resume(key, sync);  // Resume queue after handler.
            });
          } else {
            el.innerHTML = extracted.html;
            spf.debug.debug('    body update', id);
            installScripts();
          }
        } else {
          spf.tasks.suspend(key);  // Suspend main queue for animation.
          var animationKey = spf.tasks.key(el);
          // Finish a previous animation on this sub-queue, if needed.
          spf.tasks.run(animationKey, true);
          var animationFn;
          var animationData = {
            extracted: extracted,
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
            // Install styles.
            spf.nav.response.installStyles_(data.extracted);
            spf.dom.classlist.add(data.parentEl, data.startClass);
            // Reparent the existing elements.
            data.currentEl = document.createElement('div');
            data.currentEl.className = data.currentClass;
            spf.dom.inflateElement(data.parentEl, data.currentEl);
            // Add the new content.
            data.pendingEl = document.createElement('div');
            data.pendingEl.className = data.pendingClass;
            // Use the extracted HTML without scripts/styles to ensure they are
            // loaded properly.
            data.pendingEl.innerHTML = data.extracted.html;
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
            spf.debug.debug('    body update', data.parentEl.id);
            // Install scripts before continuing.
            spf.tasks.suspend(animationKey);  // Suspend sub-queue for JS.
            spf.nav.response.installScripts_(data.extracted, function() {
              spf.debug.debug('    body js', data.parentEl.id);
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
            spf.debug.debug('  process task done: body ', data.parentEl.id);
          }, null, animationData, key);
          spf.tasks.add(animationKey, animationFn);
          spf.debug.debug('  process anim queued: complete', id);
          spf.tasks.run(animationKey);
        }
      }
    }, null, id, fragments[id], response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: body', id, num);
  }
  var numAfterFragments = num;
  var numFragments = numAfterFragments - numBeforeFragments;

  // Install page scripts (single task), if needed.
  if (response['foot']) {
    fn = spf.bind(function(foot, timing, numFragments) {
      // Use the page scripts task as a signal that the content is updated,
      // only recording the content completion time if fragments were processed.
      if (numFragments) {
        timing['spfProcessBody'] = spf.now();
      }
      // Extract scripts and styles from the fragment.
      var extracted = spf.nav.response.extract_(foot);
      // Install styles.
      spf.nav.response.installStyles_(extracted);
      spf.debug.debug('    foot css');
      // Install scripts.
      // Suspend main queue to allow JS execution to occur sequentially.
      // TODO(nicksay): Consider using a sub-queue for JS execution.
      spf.tasks.suspend(key);
      spf.nav.response.installScripts_(extracted, function() {
        timing['spfProcessFoot'] = spf.now();
        spf.debug.debug('    foot js');
        spf.tasks.resume(key, sync);  // Resume main queue after JS.
        spf.debug.debug('  process task done: foot');
      });
    }, null, response['foot'], response['timing'],
        numFragments);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: foot', num);
  } else if (numFragments) {
    // If a page scripts task is unnecessary and fragments were processed,
    // add a task to record the completion time.  Doing this only if page
    // scripts won't be installed prevents unnecessary task execution and
    // potential delays.
    fn = spf.bind(function(timing) {
      timing['spfProcessBody'] = spf.now();
      spf.debug.debug('  process task done: timing-for-body');
    }, null, response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: timing-for-body', num);
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
  if (response['head']) {
    fn = spf.bind(function(head) {
      var extracted = spf.nav.response.extract_(head);
      spf.nav.response.preinstallLinks_(extracted);
      spf.nav.response.preinstallStyles_(extracted);
      spf.nav.response.preinstallScripts_(extracted);
      spf.debug.debug('  preprocess task done: head');
    }, null, response['head']);
    spf.tasks.add(key, fn);
    spf.debug.debug('  preprocess task queued: head');
  }

  // Preinstall fragment scripts and styles (one task per fragment).
  var fragments = response['body'] || {};
  for (var id in fragments) {
    if (fragments[id]) {
      fn = spf.bind(function(id, body) {
        var extracted = spf.nav.response.extract_(body);
        spf.nav.response.preinstallStyles_(extracted);
        spf.nav.response.preinstallScripts_(extracted);
        spf.debug.debug('    body js', id);
        spf.debug.debug('  preprocess task done: body', id);
      }, null, id, fragments[id]);
      spf.tasks.add(key, fn);
      spf.debug.debug('  preprocess task queued: body', id);
    }
  }

  // Preinstall page scripts (single task).
  if (response['foot']) {
    fn = spf.bind(function(foot) {
      var extracted = spf.nav.response.extract_(foot);
      spf.nav.response.preinstallStyles_(extracted);
      spf.nav.response.preinstallScripts_(extracted);
      spf.debug.debug('  preprocess task done: foot');
    }, null, response['foot']);
    spf.tasks.add(key, fn);
    spf.debug.debug('  preprocess task queued: foot');
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
 * Parses and extracts resources from an HTML string:
 *   - JS: <script> and <script src>
 *   - CSS: <style> and <link rel=stylesheet>
 *
 * @param {string|Object} html The HTML string to parse, or a pre-parsed object.
 * @return {!spf.nav.response.Extraction_}
 * @private
 */
spf.nav.response.extract_ = function(html) {
  var result = new spf.nav.response.Extraction_();
  if (!html) {
    return result;
  }

  // If the html isn't a string, it's a pre-parsed object.  Use the provided
  // values to populate the result instead.
  if (!spf.string.isString(html)) {
    // Add the parsed scripts to the result.
    if (html['scripts']) {
      spf.array.each(html['scripts'], function(script) {
        result.scripts.push({url: script['url'] || '',
                             text: script['text'] || '',
                             name: script['name'] || '',
                             async: script['async'] || false});
      });
    }
    // Add the parsed styles to the result.
    if (html['styles']) {
      spf.array.each(html['styles'], function(style) {
        result.styles.push({url: style['url'] || '',
                            text: style['text'] || '',
                            name: style['name'] || ''});
      });
    }
    // Add the parsed links to the result.
    if (html['links'] && spf.config.get('experimental-preconnect')) {
      spf.array.each(html['links'], function(link) {
        if (link['rel'] == 'preconnect') {
          result.links.push({url: link['url'] || '',
                             rel: link['rel'] || ''});
        }
      });
    }
    result.html = html['html'] || '';
    return result;
  }

  // Parse scripts and styles and add them to the result.
  html = html.replace(spf.nav.response.ElementRegEx.SCRIPT_STYLE,
      function(full, tag, attr, text) {
        // A script tag can be either an inline or external style.
        // Parse the name, src, and async attributes.
        if (tag == 'script') {
          var name = attr.match(spf.nav.response.AttributeRegEx.NAME);
          name = name ? name[1] : '';
          var url = attr.match(spf.nav.response.AttributeRegEx.SRC);
          url = url ? url[1] : '';
          var async = spf.nav.response.AttributeRegEx.ASYNC.test(attr);
          result.scripts.push({url: url, text: text, name: name, async: async});
          return '';
        }
        // A style tag is an inline style.  Parse the name attribute.
        if (tag == 'style') {
          var name = attr.match(spf.nav.response.AttributeRegEx.NAME);
          name = name ? name[1] : '';
          result.styles.push({url: '', text: text, name: name});
          return '';
        }
        // An unexpected tag was matched.  Do nothing.
        return full;
      });

  // Parse links and add them to the result.
  html = html.replace(spf.nav.response.ElementRegEx.LINK,
      function(full, attr) {
        var rel = attr.match(spf.nav.response.AttributeRegEx.REL);
        rel = rel ? rel[1] : '';
        // A rel=stylesheet tag is an external style.
        // Parse the name and href attributes.
        if (rel == 'stylesheet') {
          var name = attr.match(spf.nav.response.AttributeRegEx.NAME);
          name = name ? name[1] : '';
          var url = attr.match(spf.nav.response.AttributeRegEx.HREF);
          url = url ? url[1] : '';
          result.styles.push({url: url, text: '', name: name});
          return '';
        }
        // A rel=preconnect tag indicates early connection.
        // Parse the href attribute.
        if (rel == 'preconnect' && spf.config.get('experimental-preconnect')) {
          var url = attr.match(spf.nav.response.AttributeRegEx.HREF);
          url = url ? url[1] : '';
          result.links.push({url: url, rel: rel});
          return '';
        }
        // An unknown link was matched.  Do nothing.
        return full;
      });

  // The result html is what's left after parsing.
  result.html = html;

  return result;
};


/**
 * Installs scripts that have been parsed from an HTML string.
 * See {@link spf.net.script.load}, {@link spf.net.script.eval}, and
 * {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The parsed HTML result.
 * @param {Function=} opt_callback Callback function to execute after
 *     all scripts are loaded.
 * @private
 */
spf.nav.response.installScripts_ = function(result, opt_callback) {
  if (result.scripts.length <= 0) {
    opt_callback && opt_callback();
    return;
  }
  // Load or evaluate the scripts in order or asynchronously.
  var index = -1;
  var next = function() {
    index++;
    if (index < result.scripts.length) {
      var item = result.scripts[index];
      var fn = function() {};
      if (item.url) {
        if (spf.config.get('experimental-execute-unified')) {
          if (item.name) {
            fn = spf.bind(spf.net.script.load, null, item.url, item.name);
          } else {
            fn = spf.bind(spf.net.script.get, null, item.url);
          }
        } else {
          fn = spf.bind(spf.net.script.load, null, item.url, item.name);
        }
      } else if (item.text) {
        if (spf.config.get('experimental-execute-unified')) {
          if (item.name) {
            fn = spf.bind(spf.net.script.eval, null, item.text, item.name);
          } else {
            fn = spf.bind(spf.net.script.exec, null, item.text);
          }
        } else {
          fn = spf.bind(spf.net.script.exec, null, item.text);
        }
      }
      if (item.url && !item.async) {
        fn(next);
      } else {
        fn();
        next();
      }
    } else {
      opt_callback && opt_callback();
    }
  };
  next();
};


/**
 * Prefetches scripts that have been parsed from an HTML string.
 * See {@link spf.net.script.prefetch} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The parsed HTML result.
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
 * Installs styles that have been parsed from an HTML string.
 * See {@link spf.net.style.load}, {@link spf.net.style.eval}, and
 * {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The parsed HTML result.
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
      if (spf.config.get('experimental-execute-unified')) {
        if (item.name) {
          spf.net.style.load(item.url, item.name);
        } else {
          spf.net.style.get(item.url);
        }
      } else {
        spf.net.style.load(item.url, item.name);
      }
    } else if (item.text) {
      if (spf.config.get('experimental-execute-unified')) {
        if (item.name) {
          spf.net.style.eval(item.text, item.name);
        } else {
          spf.net.style.exec(item.text);
        }
      } else {
        spf.net.style.exec(item.text);
      }
    }
  }
};


/**
 * Prefetches styles that have been parsed from an HTML string.
 * See {@link spf.net.style.prefetch} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The parsed HTML result.
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
 * Installs links (i.e. DNS) that have been parsed from an HTML string.
 * See {@link spf.net.connect.preconnect} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The parsed HTML result.
 * @private
 */
spf.nav.response.installLinks_ = function(result) {
  // Currently, only preconnect links are supported.
  spf.nav.response.preinstallLinks_(result);
};


/**
 * Prefetches links (i.e. DNS) that have been parsed from an HTML string.
 * See {@link spf.net.connect.preconnect} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The parsed HTML result.
 * @private
 */
spf.nav.response.preinstallLinks_ = function(result) {
  if (result.links.length <= 0) {
    return;
  }
  // Preconnect.
  var urls = spf.array.map(result.links, function(item) {
    return item.rel == 'preconnect' ? item.url : '';
  });
  spf.net.connect.preconnect(urls);
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
 * A container for holding the results from parsing and extracting resources
 * from an HTML string.  See {@link #extract}.
 *
 * @constructor
 * @private
 */
spf.nav.response.Extraction_ = function() {
  /** @type {string} */
  this.html = '';
  /** @type {!Array.<{url:string, text:string, name:string, async:boolean}>} */
  this.scripts = [];
  /** @type {!Array.<{url:string, text:string, name:string}>} */
  this.styles = [];
  /** @type {!Array.<{url:string, rel:string}>} */
  this.links = [];
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
 * Regular expressions used to extract resource elements in HTML strings.
 *
 * @enum {RegExp}
 */
spf.nav.response.ElementRegEx = {
  LINK: /\x3clink([\s\S]*?)\x3e/ig,
  SCRIPT_STYLE: /\x3c(script|style)([\s\S]*?)\x3e([\s\S]*?)\x3c\/\1\x3e/ig
};


/**
 * Regular expressions used to extract attributes in HTML strings.
 * @enum {RegExp}
 */
spf.nav.response.AttributeRegEx = {
  ASYNC: /(?:\s|^)async(?:\s|=|$)/i,
  HREF: /(?:\s|^)href\s*=\s*["']?([^\s"']+)/i,
  NAME: /(?:\s|^)name\s*=\s*["']?([^\s"']+)/i,
  REL: /(?:\s|^)rel\s*=\s*["']?([^\s"']+)/i,
  SRC: /(?:\s|^)src\s*=\s*["']?([^\s"']+)/i
};


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

    spf.nav.response.extract_ = spf.tracing.instrument(
        spf.nav.response.extract_, 'spf.nav.response.extract_');

    spf.nav.response.installScripts_ = spf.tracing.instrument(
        spf.nav.response.installScripts_,
        'spf.nav.response.installScripts_');
    spf.nav.response.preinstallScripts_ = spf.tracing.instrument(
        spf.nav.response.preinstallScripts_,
        'spf.nav.response.preinstallScripts_');

    spf.nav.response.installStyles_ = spf.tracing.instrument(
        spf.nav.response.installStyles_,
        'spf.nav.response.installStyles_');
    spf.nav.response.preinstallStyles_ = spf.tracing.instrument(
        spf.nav.response.preinstallStyles_,
        'spf.nav.response.preinstallStyles_');

    spf.nav.response.installLinks_ = spf.tracing.instrument(
        spf.nav.response.installLinks_,
        'spf.nav.response.installLinks_');
    spf.nav.response.preinstallLinks_ = spf.tracing.instrument(
        spf.nav.response.preinstallLinks_,
        'spf.nav.response.preinstallLinks_');
  })();
}
