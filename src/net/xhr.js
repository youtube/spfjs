// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview Streamlined XMLHttpRequest handling functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.xhr');


/**
 * Type definition for the configuration options for an XMLHttpRequest.
 * - timeoutMs: number of milliseconds after which the request will be timed
 *      out by the client. Default is to allow the browser to handle timeouts.
 * - onSuccess: optional callback to execute if the XHR succeeds.
 * - onError: optional callback to execute if the XHR fails.
 * - onTimeout: optional callback to execute if the XHR times out.  Only called
 *      if a timeout is configured.
 *
 * @typedef {{
 *   timeoutMs: (number|undefined),
 *   onSuccess: (function(XMLHttpRequest)|undefined),
 *   onError: (function(XMLHttpRequest)|undefined),
 *   onTimeout: (function(XMLHttpRequest)|undefined)
 * }}
 */
spf.net.xhr.Options;


/**
 * Type definition for POST data.
 * @typedef {(ArrayBuffer|Blob|Document|FormData|null|string|undefined)}
 */
 spf.net.xhr.PostData;


/**
 * Sends an XMLHttpRequest object as asynchronous GET request.
 *
 * @param {string} url The URL to send the XHR to.
 * @param {spf.net.xhr.Options=} opt_options Configuration options for the XHR.
 * @return {XMLHttpRequest} The XHR object being sent.
 */
spf.net.xhr.get = function(url, opt_options) {
  return spf.net.xhr.send('GET', url, null, opt_options);
};


/**
 * Sends an XMLHttpRequest object as asynchronous POST request.
 *
 * @param {string} url The URL to send the XHR to.
 * @param {spf.net.xhr.PostData} data The data to send with the XHR.
 * @param {spf.net.xhr.Options=} opt_options Configuration options for the XHR.
 * @return {XMLHttpRequest} The XHR object being sent.
 */
spf.net.xhr.post = function(url, data, opt_options) {
  return spf.net.xhr.send('POST', url, data, opt_options);
};


/**
 * Sends an XMLHttpRequest object.
 *
 * @param {string} method The HTTP method for the XHR.
 * @param {string} url The URL to send the XHR to.
 * @param {spf.net.xhr.PostData} data The data to send with the XHR.
 * @param {spf.net.xhr.Options=} opt_options Configuration options for the XHR.
 * @return {XMLHttpRequest} The XHR object being sent.
 */
spf.net.xhr.send = function(method, url, data, opt_options) {
  var options = opt_options || {};
  var onSuccess = options.onSuccess || function() {};
  var onError = options.onError || function() {};
  var onTimeout = options.onTimeout || function() {};
  var timer;

  var xhr = spf.net.xhr.create();
  xhr.open(method, url, true);

  // Overload the abort method to handle the timer.
  var xhr_abort = xhr.abort;
  xhr.abort = function() {
    clearTimeout(timer);
    xhr.onreadystatechange = null;
    xhr_abort.call(xhr);
  };

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      clearTimeout(timer);
      switch (xhr.status) {
        case 200:  // Http Success
        case 204:  // Http Success - no content
        case 304:  // Http Cache
          onSuccess(xhr);
          break;
        default:
          onError(xhr);
          break;
      }
    }
  };

  if (options.timeoutMs > 0) {
    timer = setTimeout(function() {
      xhr.abort();
      onTimeout(xhr);
    }, options.timeoutMs);
  }

  xhr.send(null);
  return xhr;
};


/**
 * Creates a new XMLHttpRequest object.
 * @return {XMLHttpRequest} The new XHR object.
 */
spf.net.xhr.create = (function() {
  if ('XMLHttpRequest' in window) {
    return function() { return new XMLHttpRequest(); };
  } else if ('ActiveXObject' in window) {
    return function() { return new ActiveXObject('Microsoft.XMLHTTP'); };
  }
})();
