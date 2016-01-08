// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Sample JavaScript for "Chunked Test" area of the SPF demo app.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// This file exists only to test various subsystems of the framework.

var app = app || {};


/**
 * The demo app namespace for the chunked page.
 * @type {Object}
 */
app.chunked = app.chunked || {};


/**
 * Logs to the onscreen page log.
 *
 * @param {...*} var_args Arguments to log onscreen; they will be converted to
 *     strings for rendering.
 */
app.chunked.log = function(var_args) {
  var args = Array.prototype.slice.call(arguments);
  var text = args.join(' ') + '\n';
  var log = document.getElementById('chunked-log');
  log.appendChild(document.createTextNode(text));
};


/**
 * Clears the onscreen page log.
 */
app.chunked.clear = function() {
  var log = document.getElementById('chunked-log');
  log.innerHTML = '';
};


/**
 * Formats a chunked test URL.
 * @param {string} page The base URL without query params.
 * @param {Object=} opt_params The optional map of query params.
 * @return {string} The formatted URL.
 */
app.chunked.getRequestUrl = function(page, opt_params) {
  var params = {};
  var opt_params = opt_params || {};
  var els = {'chunks-input': 1, 'delay-input': 1};
  for (var id in els) {
    var el = document.getElementById(id);
    params[el.name] = el.value;
  }
  for (var k in opt_params) {
    params[k] = opt_params[k];
  }
  var url = page;
  var first = true;
  for (var k in params) {
    if (first) {
      url += '?' + k + '=' + params[k];
      first = false;
    } else {
      url += '&' + k + '=' + params[k];
    }
  }
  return url;
};


/**
 * Load a regular response sent across a variable number of transfer chunks.
 * @param {Object=} opt_params
 */
app.chunked.requestSingle = function(opt_params) {
  app.chunked.clear();
  var url = app.chunked.getRequestUrl('/chunked_sample_single', opt_params);
  spf.nav.request.send(url, {
    onPart: app.chunked.onPart,
    onSuccess: app.chunked.onSuccess,
    onError: app.chunked.onError
  });
};


/**
 * Load a multipart response for 3 partial responses sent across a variable
 * number of transfer chunks.
 * @param {Object=} opt_params
 */
app.chunked.requestMultipart = function(opt_params) {
  app.chunked.clear();
  var url = app.chunked.getRequestUrl('/chunked_sample_multipart', opt_params);
  spf.nav.request.send(url, {
    onPart: app.chunked.onPart,
    onSuccess: app.chunked.onSuccess,
    onError: app.chunked.onError
  });
};


/**
 * Handle a partial from a multipart response.
 *
 * @param {string} url The requested URL.
 * @param {Object} partial The partial response object from the chunk.
 */
app.chunked.onPart = function(url, partial) {
  app.chunked.log('PART RECEIVED', url);
  app.chunked.log(JSON.stringify(partial));
};


/**
 * Handle a success.
 *
 * @param {string} url The requested URL.
 * @param {Object} response The response object.
 */
app.chunked.onSuccess = function(url, response) {
  app.chunked.log('SUCCESS', url);
  app.chunked.log(JSON.stringify(response));
};


/**
 * Handle an error.
 *
 * @param {string} url The requested URL.
 * @param {Error} err The error.
 */
app.chunked.onError = function(url, err) {
  app.chunked.log('ERROR', url);
  app.chunked.log(err);
};


/** @override **/
app.shimHandleChunk = spf.nav.request.handleChunkFromXHR_;
/** @private **/
spf.nav.request.handleChunkFromXHR_ = function() {
  app.chunked.log('CHUNK');
  app.shimHandleChunk.apply(null, arguments);
};


/** @override **/
app.shimHandleCache = spf.nav.request.handleResponseFromCache_;
/** @private **/
spf.nav.request.handleResponseFromCache_ = function() {
  app.chunked.log('CACHE');
  app.shimHandleCache.apply(null, arguments);
};
