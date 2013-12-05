/**
 * @fileoverview Sample JavaScript for "Chunked Test" area of the SPF demo app.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// This file exists only to test various subsystems of the framework.

var demo = demo || {};


/**
 * The demo app namespace for the chunked page.
 * @type {Object}
 */
demo.chunked = demo.chunked || {};


/**
 * Check if the page is running in Dev (uncompiled) mode, so that all necessary
 * functions are available.
 */
demo.chunked.check = function() {
  if (spf && spf.nav && spf.nav.request && spf.nav.request.send) {
    return;
  }
  var actions = document.getElementById('chunked-actions');
  actions.style.display = 'none';
  var message = document.getElementById('chunked-message');
  message.style.display = 'block';
};


/**
 * Logs to the onscreen page log.
 *
 * @param {...*} var_args Arguments to log onscreen; they will be converted to
 *     strings for rendering.
 */
demo.chunked.log = function(var_args) {
  var args = Array.prototype.slice.call(arguments);
  var text = args.join(' ') + '\n';
  var log = document.getElementById('chunked-log');
  log.appendChild(document.createTextNode(text));
};


/**
 * Clears the onscreen page log.
 */
demo.chunked.clear = function() {
  var log = document.getElementById('chunked-log');
  log.innerHTML = '';
};


/**
 * Formats a chunked test URL.
 * @param {string} page The base URL without query params.
 * @param {Object=} opt_params The optional map of query params.
 * @return {string} The formatted URL.
 */
demo.chunked.getRequestUrl = function(page, opt_params) {
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
demo.chunked.requestSingle = function(opt_params) {
  demo.chunked.clear();
  var url = demo.chunked.getRequestUrl('/chunked_sample_single', opt_params);
  spf.nav.request.send(url, {
    onPart: demo.chunked.onPart,
    onSuccess: demo.chunked.onSuccess,
    onError: demo.chunked.onError
  });
};


/**
 * Load a multipart response for 3 partial responses sent across a variable
 * number of transfer chunks.
 * @param {Object=} opt_params
 */
demo.chunked.requestMultipart = function(opt_params) {
  demo.chunked.clear();
  var url = demo.chunked.getRequestUrl('/chunked_sample_multipart', opt_params);
  spf.nav.request.send(url, {
    onPart: demo.chunked.onPart,
    onSuccess: demo.chunked.onSuccess,
    onError: demo.chunked.onError
  });
};


/**
 * Handle a partial from a multipart response.
 *
 * @param {string} url The requested URL.
 * @param {Object} partial The partial response object from the chunk.
 */
demo.chunked.onPart = function(url, partial) {
  demo.chunked.log('PART RECEIVED', url);
  demo.chunked.log(JSON.stringify(partial));
};


/**
 * Handle a success.
 *
 * @param {string} url The requested URL.
 * @param {Object} response The response object.
 */
demo.chunked.onSuccess = function(url, response) {
  demo.chunked.log('SUCCESS', url);
  demo.chunked.log(JSON.stringify(response));
};


/**
 * Handle an error.
 *
 * @param {string} url The requested URL.
 * @param {Error} err The error.
 */
demo.chunked.onError = function(url, err) {
  demo.chunked.log('ERROR', url);
  demo.chunked.log(err);
};


/** @override **/
demo.shimHandleChunk = spf.nav.request.handleChunkFromXHR_;
/** @private **/
spf.nav.request.handleChunkFromXHR_ = function() {
  demo.chunked.log('CHUNK');
  demo.shimHandleChunk.apply(null, arguments);
};


/** @override **/
demo.shimHandleCache = spf.nav.request.handleResponseFromCache_;
/** @private **/
spf.nav.request.handleResponseFromCache_ = function() {
  demo.chunked.log('CACHE');
  demo.shimHandleCache.apply(null, arguments);
};
