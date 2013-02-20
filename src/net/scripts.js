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
    var targetEl = document.getElementsByTagName('head')[0] || document.body;
    // Use insertBefore instead of appendChild to avoid errors with loading
    // multiple scripts at once in IE.
    targetEl.insertBefore(scriptEl, targetEl.firstChild);
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
  var id = spf.net.scripts.ID_PREFIX + spf.string.hashCode(url);
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
  scriptEl.onload = function() {
    // IE 10 has a bug where it will synchronously call load handlers for
    // cached resources, we must force this to be async.
    setTimeout(fn, 0);
  };
  // IE < 9 does not support the onload handler, so the onreadystatechange event
  // should be used to manually call onload. This means fn will be called twice
  // in modern IE, but subsequent invocations are ignored in the callback.
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
  var targetEl = document.getElementsByTagName('head')[0] || document.body;
  // Use insertBefore instead of appendChild to avoid errors with loading
  // multiple scripts at once in IE.
  targetEl.insertBefore(scriptEl, targetEl.firstChild);
  return scriptEl;
};


/**
 * "Unloads" a script URL by finding a previously created element and
 * removing it from the document.  This will allow a URL to be loaded again
 * if needed.  Calling unload will stop execution of a pending callback, but
 * will not stop loading a pending script.
 *
 * @param {string} url Url of the script.
 */
spf.net.scripts.unload = function(url) {
  var id = spf.net.scripts.ID_PREFIX + spf.string.hashCode(url);
  var scriptEl = document.getElementById(id);
  if (scriptEl) {
    spf.pubsub.clear(id);
    scriptEl.parentNode.removeChild(scriptEl);
  }
};


/**
 * Preloads a script URL; the script will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the script when
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string} url Url of the script.
 */
spf.net.scripts.preload = function(url) {
  if (spf.net.scripts.IS_IE) {
    // IE needs a <script> in order to complete the request, but fortunately
    // will not execute it unless in the DOM.  Attempting to use an <object>
    // like other browsers will cause the download to hang.
    var scriptEl = document.createElement('script');
    scriptEl.src = url;
  } else {
    var objectEl = document.createElement('object');
    objectEl.data = url;
    objectEl.width = 0;
    objectEl.height = 0;
    document.body.appendChild(objectEl);
  }
};


/**
 * Parses an HTML string and executes scripts in the current document.
 * See {@link #load} and {@link #eval}.
 *
 * @param {string} html The HTML content to parse.
 * @param {Function=} opt_callback Callback function to execute after
 *     all scripts are loaded.
 */
spf.net.scripts.execute = function(html, opt_callback) {
  if (!html) {
    if (opt_callback) {
      opt_callback();
    }
    return;
  }
  // Extract the scripts.
  var queue = spf.net.scripts.extract_(html);
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


/**
 * Parses an HTML string and preloads script URLs.
 * See {@link #preload}.
 *
 * @param {string} html The HTML content to parse.
 */
spf.net.scripts.preexecute = function(html) {
  if (!html) {
    return;
  }
  // Extract the scripts.
  var queue = spf.net.scripts.extract_(html);
  // Preload the scripts.
  for (var i = 0; i < queue.length; i++) {
    var pair = queue[i];
    var script = pair[0];
    var isUrl = pair[1];
    if (isUrl) {
      spf.net.scripts.preload(script);
    }
  }
};


/**
 * Parses scripts from an HTML string.
 *
 * @param {string} html The HTML content to parse.
 * @return {Array.<{0:string, 1:boolean}>}
 * @private
 */
spf.net.scripts.extract_ = function(html) {
  var queue = [];
  html.replace(spf.net.scripts.SCRIPT_TAG_REGEXP,
      function(fullMatch, attr, text) {
        var url = attr.match(spf.net.scripts.SRC_ATTR_REGEXP);
        if (url) {
          queue.push([url[1], true]);
        } else {
          queue.push([text, false]);
        }
        return '';
      });
  return queue;
};


/**
 * @type {string} The ID prefix for dynamically created script elements.
 * @const
 */
spf.net.scripts.ID_PREFIX = 'js-';


/**
 * @type {boolean} Whether the browser is Internet Explorer.
 * @const
 */
spf.net.scripts.IS_IE = spf.string.contains(navigator.appName, 'Microsoft');


/**
 * Regular expression used to locate script tags in a string.
 * See {@link #extract_}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.scripts.SCRIPT_TAG_REGEXP =
    /\x3cscript([\s\S]*?)\x3e([\s\S]*?)\x3c\/script\x3e/ig;


/**
 * Regular expression used to locate src attributes in a string.
 * See {@link #extract_}.
 *
 * @type {RegExp}
 * @const
 */
spf.net.scripts.SRC_ATTR_REGEXP = /src="([\S]+)"/;
