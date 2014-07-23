// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Streamlined XMLHttpRequest handling functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.xhr');


/**
 * Type definition for the configuration options for an XMLHttpRequest.
 * - headers: map of header key/value pairs.
 * - onChunk: optional callback to execute as chunks of the XHR response
 *      are received.  Only called if a valid "Transfer-Encoding: chunked"
 *      header is received.  Each execution of the callback will pass the
 *      current chunk in addition to the XHR object.
 * - onDone: optional callback to execute once the XHR response has been
 *      been completely received .
 * - onHeaders: optional callback to execute once the XHR response headers
 *      have been received.
 * - onTimeout: optional callback to execute if the XHR times out.  Only called
 *      if a timeout is configured.
 * - timeoutMs: number of milliseconds after which the request will be timed
 *      out by the client. Default is to allow the browser to handle timeouts.
 *
 * @typedef {{
 *   headers: (Object.<string>|undefined),
 *   onChunk: (function(XMLHttpRequest, string)|undefined),
 *   onDone: (function(XMLHttpRequest)|undefined),
 *   onHeaders: (function(XMLHttpRequest)|undefined),
 *   onTimeout: (function(XMLHttpRequest)|undefined),
 *   timeoutMs: (number|undefined)
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
  var chunked = false;
  var offset = 0;
  var timer;

  var xhr = new XMLHttpRequest();
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
      // Determine whether to process chunks as they arrive.
      // This is only possible with chunked transfer encoding.
      // Note: handle Transfer-Encoding header values like:
      //   "chunked"  (standard)
      //   "Chunked"  (non-standard)
      //   "chunked, chunked"  (multiple headers sent)
      var encoding = xhr.getResponseHeader('Transfer-Encoding') || '';
      chunked = encoding.toLowerCase().indexOf('chunked') > -1;
      if (!chunked) {
        // SPDY inherently uses chunked transfer and does not define a header.
        // Firefox provides a synthetic header which can be used instead.
        // For Chrome, a non-standard JS function must be used to determine if
        // the primary document was loaded with SPDY.  If the primary document
        // was loaded with SPDY, then most likely the XHR will be as well.
        var firefoxSpdy = xhr.getResponseHeader('X-Firefox-Spdy');
        var loadTimes = window.chrome && chrome.loadTimes && chrome.loadTimes();
        var chromeSpdy = loadTimes && loadTimes.wasFetchedViaSpdy;
        chunked = !!(firefoxSpdy || chromeSpdy);
      }
      if (options.onHeaders) {
        options.onHeaders(xhr);
      }
    } else if (xhr.readyState == spf.net.xhr.State.LOADING) {
      if (chunked && options.onChunk) {
        var chunk = xhr.responseText.substring(offset);
        offset = xhr.responseText.length;
        options.onChunk(xhr, chunk);
      }
    } else if (xhr.readyState == spf.net.xhr.State.DONE) {
      // Record responseEnd time when full response is received.
      timing['responseEnd'] = timing['responseEnd'] || spf.now();
      // Record Resource Timing relative timings (where available) to later be
      // converted into Navigation Timing absolute timings.
      if (window.performance && window.performance.getEntriesByName) {
        xhr['resourceTiming'] = window.performance.getEntriesByName(url)[0];
      }
      // If processing chunks as they arrive and the state was transitioned
      // at response end to DONE without a LOADING, process the final chunk now.
      if (chunked && options.onChunk && xhr.responseText.length > offset) {
        var chunk = xhr.responseText.substring(offset);
        offset = xhr.responseText.length;
        options.onChunk(xhr, chunk);
      }
      clearTimeout(timer);
      if (options.onDone) {
        options.onDone(xhr);
      }
    }
  };

  var addContentType = (method == 'POST');

  if (options.headers) {
    for (var key in options.headers) {
      xhr.setRequestHeader(key, options.headers[key]);
      if ('content-type' == key.toLowerCase()) {
        addContentType = false;
      }
    }
  }

  if (addContentType) {
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  }

  if (options.timeoutMs > 0) {
    timer = setTimeout(function() {
      xhr.abort();
      if (options.onTimeout) {
        options.onTimeout(xhr);
      }
    }, options.timeoutMs);
  }

  // Record fetchStart time when request is sent.
  xhr['timing']['fetchStart'] = spf.now();
  xhr.send(data);

  return xhr;
};


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
