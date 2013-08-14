/**
 * @fileoverview Streamlined XMLHttpRequest handling functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.xhr');


/**
 * Type definition for the configuration options for an XMLHttpRequest.
 * - headers: map of header key/value pairs.
 * - timeoutMs: number of milliseconds after which the request will be timed
 *      out by the client. Default is to allow the browser to handle timeouts.
 * - onSuccess: optional callback to execute if the XHR succeeds.
 * - onError: optional callback to execute if the XHR fails.
 * - onTimeout: optional callback to execute if the XHR times out.  Only called
 *      if a timeout is configured.
 * - onBeginResponse: optional callback to execute when the XHR begins
 *      receiving the response.
 *
 * @typedef {{
 *   headers: (Object.<string>|undefined),
 *   timeoutMs: (number|undefined),
 *   onSuccess: (function(XMLHttpRequest)|undefined),
 *   onError: (function(XMLHttpRequest)|undefined),
 *   onTimeout: (function(XMLHttpRequest)|undefined),
 *   onBeginResponse: (function(XMLHttpRequest)|undefined)
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
  var onBeginResponse = options.onBeginResponse || function() {};
  var timer;

  var xhr = spf.net.xhr.create();
  xhr.open(method, url, true);
  xhr['timing'] = {};

  // Overload the abort method to handle the timer.
  var xhr_abort = xhr.abort;
  xhr.abort = function() {
    clearTimeout(timer);
    xhr.onreadystatechange = null;
    xhr_abort.call(xhr);
  };

  xhr.onreadystatechange = function() {
    var timing = xhr['timing'];
    if (xhr.readyState == spf.net.xhr.State.HEADERS_RECEIVED) {
      // Record responseStart time when first byte is received.
      timing['responseStart'] = timing['responseStart'] || spf.now();
      onBeginResponse(xhr);
    } else if (xhr.readyState == spf.net.xhr.State.DONE) {
      // Record responseEnd time when full response is received.
      timing['responseEnd'] = timing['responseEnd'] || spf.now();
      clearTimeout(timer);
      switch (xhr.status) {
        case 200:  // HTTP Success: OK
        case 201:  // HTTP Success: Created
        case 202:  // HTTP Success: Accepted
        case 203:  // HTTP Success: Non-Authoritative Information
        case 204:  // HTTP Success: No Content
        case 205:  // HTTP Success: Reset Content
        case 206:  // HTTP Success: Partial Content
        case 304:  // HTTP Redirection: Not Modified
          onSuccess(xhr);
          break;
        default:
          onError(xhr);
          break;
      }
    }
  };

  if (options.headers) {
    for (var key in options.headers) {
      xhr.setRequestHeader(key, options.headers[key]);
    }
  }

  if (options.timeoutMs > 0) {
    timer = setTimeout(function() {
      xhr.abort();
      onTimeout(xhr);
    }, options.timeoutMs);
  }

  // Record fetchStart time when request is sent.
  xhr['timing']['fetchStart'] = spf.now();
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


/**
 * @enum {number}
 */
spf.net.xhr.State = {
  UNSENT: 0,
  OPENED: 1,
  HEADERS_RECEIVED: 2,
  LOADING: 3,
  DONE: 4
};
