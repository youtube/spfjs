// Copyright 2013 Google Inc. All rights reserved.
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
goog.require('spf.dom.dataset');
goog.require('spf.history');
goog.require('spf.net.connect');
goog.require('spf.net.script');
goog.require('spf.net.style');
goog.require('spf.string');
goog.require('spf.tasks');
goog.require('spf.tracing');
goog.require('spf.url');


/**
 * Parses text for an SPF response.  If `opt_multipart` is true, attempts
 * to parse the text for one or more (in)complete multipart SPF responses.
 *
 * @param {string} text Text to parse.
 * @param {boolean=} opt_multipart Whether to attempt to parse the text for
 *     one or more multipart SPF response sections.
 * @param {boolean=} opt_lastDitch Whether to parse the text as the final
 *     one, potentially handling malformed but valid responses.  Requires
 *     `opt_multipart` to be true.
 * @throws {Error} If the `text` contains invalid JSON, or when
 *     `opt_multipart` is true, if a section of a multipart response
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
    parts = spf.nav.response.extract(parts);
    return {
      parts: /** @type {Array.<spf.SingleResponse>} */(parts),
      extra: extra
    };
  } else {
    var response = JSON.parse(text);
    var parts = spf.nav.response.extract(spf.array.toArray(response));
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
 * @param {spf.nav.Info=} opt_info The navigation info object.
 * @param {function(string, spf.SingleResponse)=} opt_callback Function to
 *     execute when processing is done; the first argument is `url`,
 *     the second argument is `response`.
 */
spf.nav.response.process = function(url, response, opt_info, opt_callback) {
  spf.debug.info('nav.response.process ', response, opt_info);

  var isNavigate = opt_info && spf.string.startsWith(opt_info.type, 'navigate');
  var isReverse = opt_info && opt_info.reverse;
  var hasPosition = opt_info && !!opt_info.position;
  var hasScrolled = opt_info && opt_info.scrolled;

  var name = response['name'] || '';

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
  // Only navigation requests should process URL changes.
  if (isNavigate && response['url']) {
    var fullUrl = spf.url.absolute(response['url']);
    // Update the history state if the url doesn't match.
    if (fullUrl != spf.nav.response.getCurrentUrl_()) {
      spf.debug.debug('  update history with response url');
      // Add the URL to the history stack, including hash.
      spf.history.replace(response['url'] + window.location.hash);
    }
  }

  // Install head scripts and styles (single task), if needed.
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
        // Resume main queue after JS.
        spf.tasks.resume(key, sync);
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
        // Scroll to the top before the first content update, if needed.
        // Only non-history navigation requests scroll to the top immediately.
        // Other history navigation requests handle scrolling after all
        // processing is done to avoid jumping to the top and back down to the
        // saved position afterwards.
        if (isNavigate && !hasPosition && !hasScrolled) {
          spf.state.set(spf.state.Key.NAV_SCROLL_TEMP_POSITION, null);
          spf.state.set(spf.state.Key.NAV_SCROLL_TEMP_URL, null);
          spf.debug.debug('    scrolling to top');
          window.scroll(0, 0);
          hasScrolled = true;
          if (opt_info) {
            opt_info.scrolled = true;
          }
        }
        // Extract scripts and styles from the fragment.
        var extracted = spf.nav.response.extract_(body);
        // Install styles.
        spf.nav.response.installStyles_(extracted);
        // Set up scripts to be installed after the html is updated.
        var installScripts = function() {
          // Install scripts.
          // Suspend main queue to allow JS execution to occur sequentially.
          // TODO(nicksay): Consider using a sub-queue for JS execution.
          spf.tasks.suspend(key);
          spf.nav.response.installScripts_(extracted, function() {
            // Resume main queue after JS.
            spf.tasks.resume(key, sync);
            spf.debug.debug('  process task done: body', id);
          });
        };

        var animationClass = /** @type {string} */ (
            spf.config.get('animation-class'));
        var noAnimation = (!spf.nav.response.CAN_ANIMATE_ ||
                           !spf.dom.classlist.contains(el, animationClass));
        if (noAnimation) {
          var htmlHandler = /** @type {Function} */(
              spf.config.get('experimental-html-handler'));
          if (htmlHandler) {
            // Suspend main queue for the experimental HTML handler.
            spf.tasks.suspend(key);
            htmlHandler(extracted['html'], el, function() {
              installScripts();
              // Resume main queue after the experimental HTML handler.
              spf.tasks.resume(key, sync);
            });
          } else {
            el.innerHTML = extracted['html'];
            installScripts();
          }
        } else {
          var animation = new spf.nav.response.Animation_(
              el,
              extracted['html'],
              animationClass,
              name,
              parseInt(spf.config.get('animation-duration'), 10),
              !!isReverse);
          // Suspend main queue while the animation is running.
          spf.tasks.suspend(key);
          // Finish a previous animation on this sub-queue, if needed.
          spf.tasks.run(animation.key, true);
          // Animation task 1: insert new, delay = 0.
          spf.tasks.add(
              animation.key,
              spf.bind(spf.nav.response.prepareAnimation_, null, animation),
              0);
          spf.debug.debug('  process queued prepare animation', id);
          // Animation task 2: switch, delay = 17ms = 1 frame @ 60fps.
          spf.tasks.add(
              animation.key,
              spf.bind(spf.nav.response.runAnimation_, null, animation),
              17);
          spf.debug.debug('  process queued run animation', id);
          // Animation task 3: remove old, delay = config.
          spf.tasks.add(
              animation.key,
              spf.bind(spf.nav.response.completeAnimation_, null, animation),
              animation.duration);
          spf.debug.debug('  process queued complete animation', id);
          // Resume main queue after animation is done.
          spf.tasks.add(
              animation.key,
              spf.bind(function() {
                installScripts();
                spf.tasks.resume(key, sync);
              }, null),
              0);
          spf.tasks.run(animation.key);
        }
      }
    }, null, id, fragments[id], response['timing']);
    num = spf.tasks.add(key, fn);
    spf.debug.debug('  process task queued: body', id, num);
  }
  var numAfterFragments = num;
  var numFragments = numAfterFragments - numBeforeFragments;

  // Install foot scripts and styles (single task), if needed.
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

  spf.debug.debug('  process run', key, sync);
  spf.tasks.run(key, sync);
};


/**
 * Preprocesses a SPF response.

 * Similar to {@link #process} but instead of page content being updated,
 * script and stylesheet URLs are prefetched.
 *
 * @param {string} url The URL of the response being preprocessed.
 * @param {spf.SingleResponse} response The SPF response object to preprocess.
 * @param {spf.nav.Info=} opt_info The navigation info object.
 * @param {function(string, spf.SingleResponse)=} opt_callback Function to
 *     execute when preprocessing is done; the first argument is `url`,
 *     the second argument is `response`.
 */
spf.nav.response.preprocess = function(url, response, opt_info, opt_callback) {
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
 * @param {spf.nav.response.Animation_} data The animation data.
 * @private
 */
spf.nav.response.prepareAnimation_ = function(data) {
  // Add the start class to put elements in their beginning states.
  spf.dom.classlist.add(data.element, data.dirClass);
  spf.dom.classlist.add(data.element, data.fromClass);
  spf.dom.classlist.add(data.element, data.toClass);
  spf.dom.classlist.add(data.element, data.startClass);
  spf.dom.classlist.add(data.element, data.startClassDeprecated);
  // Pack the existing content into a temporary container.
  data.oldEl = document.createElement('div');
  data.oldEl.className = data.oldClass;
  spf.dom.packElement(data.element, data.oldEl);
  // Place the new content into a temporary container as a sibling.
  data.newEl = document.createElement('div');
  data.newEl.className = data.newClass;
  data.newEl.innerHTML = data.html;
  if (data.reverse) {
    spf.dom.insertSiblingBefore(data.newEl, data.oldEl);
  } else {
    spf.dom.insertSiblingAfter(data.newEl, data.oldEl);
  }
  spf.debug.debug('  process done prepare animation', data.element.id);
};


/**
 * @param {spf.nav.response.Animation_} data The animation data.
 * @private
 */
spf.nav.response.runAnimation_ = function(data) {
  spf.dom.classlist.remove(data.element, data.startClass);
  spf.dom.classlist.remove(data.element, data.startClassDeprecated);
  spf.dom.classlist.add(data.element, data.endClass);
  spf.dom.classlist.add(data.element, data.endClassDeprecated);
  spf.debug.debug('  process done run animation', data.element.id);
};


/**
 * @param {spf.nav.response.Animation_} data The animation data.
 * @private
 */
spf.nav.response.completeAnimation_ = function(data) {
  // Remove the old content.
  data.element.removeChild(data.oldEl);
  // Unpack the new content from the temporary container.
  spf.dom.unpackElement(data.newEl);
  // Remove the end class to put elements back in normal state.
  spf.dom.classlist.remove(data.element, data.endClass);
  spf.dom.classlist.remove(data.element, data.endClassDeprecated);
  spf.dom.classlist.remove(data.element, data.fromClass);
  spf.dom.classlist.remove(data.element, data.toClass);
  spf.dom.classlist.remove(data.element, data.dirClass);
  spf.debug.debug('  process done complete animation', data.element.id);
};


/**
 * Extracts all resources from HTML in a SPF response.
 *
 * @param {T} response The SPF response object to extract.
 * @return {T} The response, updated to have resources extracted from HTML
 *     strings.  This does not create a new object and modifies the passed
 *     response in-place.
 * @template T
 */
spf.nav.response.extract = function(response) {
  spf.debug.debug('spf.nav.response.extract', response);
  var parts = spf.array.toArray(response);
  spf.array.each(parts, function(part) {
    if (part) {
      if (part['head']) {
        part['head'] = spf.nav.response.extract_(part['head']);
      }
      if (part['body']) {
        for (var id in part['body']) {
          part['body'][id] = spf.nav.response.extract_(part['body'][id]);
        }
      }
      if (part['foot']) {
        part['foot'] = spf.nav.response.extract_(part['foot']);
      }
    }
  });
  return response;
};


/**
 * Extracts resources from an HTML string:
 *   - JS: <script> and <script src>
 *   - CSS: <style> and <link rel=stylesheet>
 *
 * @param {spf.ResponseFragment|spf.nav.response.Extraction_} frag The response
 *     fragment (either a HTML string to parse or a pre-parsed object), or a
 *     previous extraction result.
 * @return {!spf.nav.response.Extraction_}
 * @private
 */
spf.nav.response.extract_ = function(frag) {
  var result = new spf.nav.response.Extraction_();
  if (!frag) {
    return result;
  }

  // If the fragment isn't a string, it's a pre-parsed object.  Use the
  // provided values to populate the result instead.
  if (!spf.string.isString(frag)) {
    // Add the parsed scripts to the result.
    if (frag['scripts']) {
      spf.array.each(frag['scripts'], function(script) {
        result['scripts'].push({url: script['url'] || '',
                             text: script['text'] || '',
                             name: script['name'] || '',
                             async: script['async'] || false});
      });
    }
    // Add the parsed styles to the result.
    if (frag['styles']) {
      spf.array.each(frag['styles'], function(style) {
        result['styles'].push({url: style['url'] || '',
                            text: style['text'] || '',
                            name: style['name'] || ''});
      });
    }
    // Add the parsed links to the result.
    if (frag['links']) {
      spf.array.each(frag['links'], function(link) {
        if (link['rel'] == 'spf-preconnect') {
          result['links'].push({url: link['url'] || '',
                             rel: link['rel'] || ''});
        }
      });
    }
    result['html'] = frag['html'] || '';
    return result;
  }

  // Re-assure the compiler that the fragment is a string at this point.
  frag = /** @type {string} */ (frag);

  // Parse scripts and styles and add them to the result.
  frag = frag.replace(spf.nav.response.ElementRegEx.SCRIPT_STYLE,
      function(full, tag, attr, text) {
        // A script tag can be either an inline or external style.
        // Parse the name, src, and async attributes.
        if (tag == 'script') {
          var name = attr.match(spf.nav.response.AttributeRegEx.NAME);
          name = name ? name[1] : '';
          var url = attr.match(spf.nav.response.AttributeRegEx.SRC);
          url = url ? url[1] : '';
          var async = spf.nav.response.AttributeRegEx.ASYNC.test(attr);
          var type = spf.nav.response.AttributeRegEx.TYPE.exec(attr);
          var inject = !type || spf.string.contains(type[1], '/javascript') ||
              spf.string.contains(type[1], '/x-javascript') ||
              spf.string.contains(type[1], '/ecmascript');
          if (inject) {
            result['scripts'].push(
                {url: url, text: text, name: name, async: async});
            return '';
          } else {
            return full;
          }
        }
        // A style tag is an inline style.  Parse the name attribute.
        if (tag == 'style') {
          var name = attr.match(spf.nav.response.AttributeRegEx.NAME);
          name = name ? name[1] : '';
          var type = spf.nav.response.AttributeRegEx.TYPE.exec(attr);
          var inject = !type || spf.string.contains(type[1], 'text/css');
          if (inject) {
            result['styles'].push({url: '', text: text, name: name});
            return '';
          } else {
            return full;
          }
        }
        // An unexpected tag was matched.  Do nothing.
        return full;
      });

  // Parse links and add them to the result.
  frag = frag.replace(spf.nav.response.ElementRegEx.LINK,
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
          result['styles'].push({url: url, text: '', name: name});
          return '';
        }
        // A rel=spf-preconnect tag indicates early connection.
        // Parse the href attribute.
        if (rel == 'spf-preconnect') {
          var url = attr.match(spf.nav.response.AttributeRegEx.HREF);
          url = url ? url[1] : '';
          result['links'].push({url: url, rel: rel});
          return '';
        }
        // An unknown link was matched.  Do nothing.
        return full;
      });

  // The result html is what's left after parsing.
  result['html'] = frag;

  return result;
};


/**
 * Installs scripts that have been extracted from an HTML string.
 * See {@link spf.net.script.load}, {@link spf.net.script.eval}, and
 * {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The extraction result.
 * @param {Function=} opt_callback Callback function to execute after
 *     all scripts are loaded.
 * @private
 */
spf.nav.response.installScripts_ = function(result, opt_callback) {
  if (result['scripts'].length <= 0) {
    opt_callback && opt_callback();
    return;
  }
  // Load or evaluate the scripts in order or asynchronously.
  var index = -1;
  var next = function() {
    index++;
    if (index < result['scripts'].length) {
      var item = result['scripts'][index];
      var fn = function() {};
      if (item.url) {
        if (item.name) {
          fn = spf.bind(spf.net.script.load, null, item.url, item.name);
        } else {
          fn = spf.bind(spf.net.script.get, null, item.url);
        }
      } else if (item.text) {
        if (item.name) {
          fn = spf.bind(spf.net.script.eval, null, item.text, item.name);
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
 * Prefetches scripts that have been extracted from an HTML string.
 * See {@link spf.net.script.prefetch} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The extraction result.
 * @private
 */
spf.nav.response.preinstallScripts_ = function(result) {
  if (result['scripts'].length <= 0) {
    return;
  }
  // Prefetch the scripts.
  var urls = spf.array.map(result['scripts'], function(item) {
    return item.url;
  });
  spf.net.script.prefetch(urls);
};


/**
 * Installs styles that have been extracted from an HTML string.
 * See {@link spf.net.style.load}, {@link spf.net.style.eval}, and
 * {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The extraction result.
 * @private
 */
spf.nav.response.installStyles_ = function(result) {
  if (result['styles'].length <= 0) {
    return;
  }
  // Install the styles.
  spf.array.each(result['styles'], function(item) {
    if (item.url) {
      if (item.name) {
        spf.net.style.load(item.url, item.name);
      } else {
        spf.net.style.get(item.url);
      }
    } else if (item.text) {
      if (item.name) {
        spf.net.style.eval(item.text, item.name);
      } else {
        spf.net.style.exec(item.text);
      }
    }
  });
};


/**
 * Prefetches styles that have been extracted from an HTML string.
 * See {@link spf.net.style.prefetch} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The extraction result.
 * @private
 */
spf.nav.response.preinstallStyles_ = function(result) {
  if (result['styles'].length <= 0) {
    return;
  }
  // Prefetch the styles.
  var urls = spf.array.map(result['styles'], function(item) {
    return item.url;
  });
  spf.net.style.prefetch(urls);
};


/**
 * Installs links (i.e. DNS) that have extracted from an HTML string.
 * See {@link spf.net.connect.preconnect} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The extraction result.
 * @private
 */
spf.nav.response.installLinks_ = function(result) {
  // Currently, only preconnect links are supported.
  spf.nav.response.preinstallLinks_(result);
};


/**
 * Prefetches links (i.e. DNS) that have been extracted from an HTML string.
 * See {@link spf.net.connect.preconnect} and {@link #extract_}.
 *
 * @param {!spf.nav.response.Extraction_} result The extraction result.
 * @private
 */
spf.nav.response.preinstallLinks_ = function(result) {
  if (result['links'].length <= 0) {
    return;
  }
  // Preconnect.
  var urls = spf.array.map(result['links'], function(item) {
    return item.rel == 'spf-preconnect' ? item.url : '';
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
 * A container for holding data during an animated content update.
 * See {@link #process}.
 *
 * @param {!Element} el The element being updated.
 * @param {string} html The new content for the element.
 * @param {string} cls The animation class name.
 * @param {string} name The page name.
 * @param {number} duration The animation duration.
 * @param {boolean} reverse Whether this is a "back" animation.
 * @constructor
 * @struct
 * @private
 */
spf.nav.response.Animation_ = function(el, html, cls, name, duration, reverse) {
  /** @type {!Element} */
  this.element = el;
  /** @type {string} */
  this.html = html;
  /** @type {number} */
  this.duration = duration;
  /** @type {boolean} */
  this.reverse = reverse;

  var prevName = spf.dom.dataset.get(document.body, 'spfName') || '';

  /** @type {string} */
  this.key = spf.tasks.key(el);
  /** @type {string} */
  this.fromClass = prevName && (cls + '-from-' + prevName);
  /** @type {string} */
  this.toClass = name && (cls + '-to-' + name);
  /** @type {Element} */
  this.oldEl = null;
  /** @type {string} */
  this.oldClass = cls + '-old';
  /** @type {Element} */
  this.newEl = null;
  /** @type {string} */
  this.newClass = cls + '-new';
  /** @type {string} */
  this.dirClass = cls + (reverse ? '-reverse' : '-forward');
  /** @type {string} */
  this.startClass = cls + '-start';
  /** @type {string} */
  this.startClassDeprecated = this.dirClass + '-start';
  /** @type {string} */
  this.endClass = cls + '-end';
  /** @type {string} */
  this.endClassDeprecated = this.dirClass + '-end';
};


/**
 * A container for holding the results from parsing and extracting resources
 * from an HTML string.  See {@link #extract_}.
 *
 * Note: This container should be accessed as a dict (obj['foo']) not as a
 * struct (obj.foo) to ensure consistency when accessing parsed responses
 * cached by previous versions of SPF.
 *
 * @constructor
 * @dict
 * @private
 */
// TODO(nicksay): Consider a shared interface for spf.nav.response.Extraction_
// and spf.ResponseFragment.
spf.nav.response.Extraction_ = function() {
  /** @type {string} */
  this['html'] = '';
  /** @type {!Array.<{url:string, text:string, name:string, async:boolean}>} */
  this['scripts'] = [];
  /** @type {!Array.<{url:string, text:string, name:string}>} */
  this['styles'] = [];
  /** @type {!Array.<{url:string, rel:string}>} */
  this['links'] = [];
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
  return spf.array.some(prefixes, function(prefix) {
    return prefix + 'Transition' in testEl.style;
  });
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
  SRC: /(?:\s|^)src\s*=\s*["']?([^\s"']+)/i,
  TYPE: /(?:\s|^)type\s*=\s*["']([^"']+)["']/i
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

    spf.nav.response.extract = spf.tracing.instrument(
        spf.nav.response.extract, 'spf.nav.response.extract');
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
