// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview Functions for dynamically loading scripts without blocking.
 * By nesting multiple calls in callback parameters, execution order of
 * the scripts can be preserved as well.
 *
 * Single script example:
 * spf.net.scripts.load(url, function() {
 *   doSomethingAfterOneScriptIsLoaded();
 * });
 *
 * Multiple script example, preserving execution order of the scripts:
 * spf.net.scripts.load(url1, function() {
 *   spf.net.scripts.load(url2, function() {
 *     doSomethingAfterTwoScriptsAreLoadedInOrder();
 *   });
 * });
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.scripts');

goog.require('spf.dom.dataset');
goog.require('spf.pubsub');
goog.require('spf.string');


/**
 * Evaluates a script text by dynamically creating an element and appending it
 * to the document.  A callback can be specified to execute once the script
 * has been loaded.
 *
 * @param {string} text The text of the script.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 */
spf.net.scripts.eval = function(text, opt_callback) {
  if (window.execScript) {
    window.execScript(text, 'JavaScript');
  } else {
    var scriptEl = document.createElement('script');
    scriptEl.appendChild(document.createTextNode(text));
    // Place the scripts in the head instead of the body to avoid errors when
    // called from the head in the first place.
    var head = document.getElementsByTagName('head')[0];
    // Use insertBefore instead of appendChild to avoid errors with loading
    // multiple scripts at once in IE.
    head.insertBefore(scriptEl, head.firstChild);
  }
  if (opt_callback) {
    opt_callback();
  }
};


/**
 * Loads a script URL by dynamically creating an element and appending it to
 * the document.  A callback can be specified to execute once the script
 * has been loaded.  Subsequent calls to load the same URL will not
 * reload the script.
 *
 * @param {string} url Url of the script.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 * @return {Element} The dynamically created script element.
 */
spf.net.scripts.load = function(url, opt_callback) {
  var id = 'spf-js-' + spf.string.hashCode(url);
  var scriptEl = document.getElementById(id);
  var isLoaded = scriptEl && spf.dom.dataset.get(scriptEl, 'loaded');
  var isLoading = scriptEl && !isLoaded;
  // If the script is already loaded, execute the callback(s) immediately.
  if (isLoaded) {
    if (opt_callback) {
      opt_callback();
    }
    return scriptEl;
  }
  // Register the callback.
  if (opt_callback) {
    spf.pubsub.subscribe(id, opt_callback);
  }
  // If the script is currently loading, wait.
  if (isLoading) {
    return scriptEl;
  }
  // Otherwise, the script needs to be loaded.
  // Lexical closures allow this trickiness with the "el" variable.
  var el = spf.net.scripts.load_(url, id, function() {
    if (!spf.dom.dataset.get(el, 'loaded')) {
      spf.dom.dataset.set(el, 'loaded', 'true');
      spf.pubsub.publish(id);
      spf.pubsub.clear(id);
    }
  });
  return el;
};


/**
 * See {@link #load}.
 *
 * @param {string} url Url of the script.
 * @param {string} id Id of the script element.
 * @param {Function} fn Callback for when the script has loaded.
 * @return {Element} The dynamically created script element.
 * @private
 */
spf.net.scripts.load_ = function(url, id, fn) {
  var scriptEl = document.createElement('script');
  scriptEl.id = id;
  // Safari/Chrome and Firefox support the onload event for scripts.
  scriptEl.onload = fn;
  // IE supports the onreadystatechange event; have it call the onload
  // handler when appropriate.
  scriptEl.onreadystatechange = function() {
    switch (scriptEl.readyState) {
      case 'loaded':
      case 'complete':
        scriptEl.onload();
    }
  };
  // Set the onload and onreadystatechange handlers before setting the src
  // to avoid potential IE bug where handlers are not called.
  scriptEl.src = url;
  // Place the scripts in the head instead of the body to avoid errors when
  // called from the head in the first place.
  var head = document.getElementsByTagName('head')[0];
  // Use insertBefore instead of appendChild to avoid errors with loading
  // multiple scripts at once in IE.
  head.insertBefore(scriptEl, head.firstChild);
  return scriptEl;
};


/**
 * Parses scripts from an HTML string and executes them in the current
 * document.
 *
 * @param {string} html The complete HTML content to use as a source for
 *     updates.
 * @param {Function=} opt_callback Callback function to execute after
 *     all scripts are loaded.
 */
spf.net.scripts.execute = function(html, opt_callback) {
  if (!html) {
    return;
  }
  var queue = [];
  // Extract the scripts.
  html = html.replace(/\x3cscript([\s\S]*?)\x3e([\s\S]*?)\x3c\/script\x3e/ig,
      function(fullMatch, attr, text) {
        var url = attr.match(/src="([\S]+)"/);
          if (url) {
            queue.push([url[1], true]);
          } else {
            queue.push([text, false]);
          }
        return '';
      });
  // Load or evaluate the scripts in order.
  var getNextScript = function() {
    if (queue.length > 0) {
      var pair = queue.shift();
      var script = pair[0];
      var isUrl = pair[1];
      if (isUrl) {
        spf.net.scripts.load(script, getNextScript);
      } else {
        spf.net.scripts.eval(script, getNextScript);
      }
    } else {
      if (opt_callback) {
        opt_callback();
      }
    }
  };
  getNextScript();
};
