/**
 * @fileoverview Navigation-related request functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.nav.request');

goog.require('spf');
goog.require('spf.cache');
goog.require('spf.config');
goog.require('spf.debug');
goog.require('spf.nav.response');
goog.require('spf.nav.url');
goog.require('spf.net.xhr');
goog.require('spf.string');


/**
 * Type definition for the configuration options for an SPF request.
 * - method: optional method with which to send the request; defaults to "GET".
 * - onPart: optional callback to execute with the parts of a multipart
 *       response.  The first argumet is the requested URL; the second argument
 *       is the partial response object.  If valid
 *       "X-SPF-Response-Type: multipart" and "Transfer-Encoding: chunked"
 *       headers are sent, then this callback be executed on-the-fly as chunks
 *       are received.
 * - onError: optional callback to execute if the request fails. The first
 *       argument is the requested URL; the second argument is the Error that
 *       occurred. If the type of request is "navigate", the second argument
 *       might be false if the request was canceled in response to the global
 *       "navigate-received" callback.
 * - onSuccess: optional callback to execute if the request succeeds.  The first
 *       argument is the requested URL; the second is the response object.  The
 *       response object will be either a complete single response object or
 *       a complete multipart response object.
 * - postData: optional data to send with the request.  Only used if the method
 *       is set to "POST".
 * - referer: optional referrer URL, without the SPF identifier.
 * - type: optional type of request (e.g. "navigate", "load", etc), used to
 *       alter the URL identifier and XHR header and used to determine whether
 *       the global "navigation received" callback is executed; defaults to
 *       "request".
 *
 * @typedef {{
 *   method: (string|undefined),
 *   onPart: (function(string, spf.SingleResponse)|undefined),
 *   onError: (function(string, (Error|boolean))|undefined),
 *   onSuccess: (function(string,
 *                   (spf.SingleResponse|spf.MultipartResponse))|undefined),
 *   postData: spf.net.xhr.PostData,
 *   referer: (string|null|undefined),
 *   type: (string|undefined),
 *   startTime: (number|undefined)
 * }}
 */
spf.nav.request.Options;


/**
 * Requests a URL using the SPF protocol and parses the response.  If
 * successful, the URL and response object are passed to the optional
 * {@code onSuccess} callback.  If not, the URL is passed to the optional
 * {@code onError} callback.  If chunked response are being used, the
 * URL and each partial response object will be passed to the optional
 * {@code onPart} callback as they are received.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.nav.request.Options=} opt_options Configuration options.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.nav.request.send = function(url, opt_options) {
  spf.debug.debug('nav.request.send ', url, opt_options);
  var options = opt_options || /** @type {spf.nav.request.Options} */ ({});
  options.method = ((options.method || 'GET') + '').toUpperCase();
  options.type = options.type || 'request';
  // Convert the URL to absolute, to be used for caching the response.
  var absoluteUrl = spf.nav.url.absolute(url);
  spf.debug.debug('    absolute url ', absoluteUrl);
  // Add the SPF identifier, to be used for sending the request.
  var requestUrl = spf.nav.url.identify(absoluteUrl, options.type);
  spf.debug.debug('    identified url ', requestUrl);
  // Record a the time before sending the request or loading from cache.
  // The startTime is consistent with W3C PerformanceResourceTiming for XHRs.
  var timing = {};
  timing['startTime'] = options.startTime || spf.now();
  // Try to find a cached response for the request before sending a new XHR.
  // Record fetchStart time before loading from cache. If no cached response
  // is found, this value will be replaced with the one provided by the XHR.
  timing['fetchStart'] = timing['startTime'];
  // Use the absolute URL without identifier to allow cached responses
  // from prefetching to apply to navigation.
  var cached = /** @type {spf.SingleResponse|spf.MultipartResponse} */ (
      spf.cache.get(absoluteUrl));
  if (cached) {
    // To ensure a similar execution pattern as an XHR, ensure the
    // cache response is returned asynchronously.
    var handleCache = spf.bind(spf.nav.request.handleResponseFromCache_, null,
                               url, options, timing, cached);
    setTimeout(handleCache, 0);
    // Return null because no XHR is made.
    return null;
  } else {
    spf.debug.debug('    sending XHR');
    var headers = {'X-SPF-Request': options.type};
    if (options.referer) {
      headers['X-SPF-Referer'] = options.referer;
    }
    var chunking = {
      multipart: false,
      extra: '',
      complete: []
    };
    var handleHeaders = spf.bind(spf.nav.request.handleHeadersFromXHR_, null,
                                 url, chunking);
    var handleChunk = spf.bind(spf.nav.request.handleChunkFromXHR_, null,
                               url, options, chunking);
    var handleComplete = spf.bind(spf.nav.request.handleCompleteFromXHR_, null,
                                  url, options, timing, chunking);
    var xhrOpts = {
      headers: headers,
      timeoutMs: /** @type {number} */ (spf.config.get('request-timeout')),
      onHeaders: handleHeaders,
      onChunk: handleChunk,
      onDone: handleComplete,
      onTimeout: handleComplete
    };
    var xhr;
    if (options.method == 'POST') {
      xhr = spf.net.xhr.post(requestUrl, options.postData, xhrOpts);
    } else {
      xhr = spf.net.xhr.get(requestUrl, xhrOpts);
    }
    // Return the XHR being made.
    return xhr;
  }
};


/**
 * Handles a cached response.
 * See {@link #send}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.nav.request.Options} options Configuration options
 * @param {Object} timing Timing data.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The cached SPF
 *     response object.
 * @private
 */
spf.nav.request.handleResponseFromCache_ = function(url, options, timing,
                                                    response) {
  spf.debug.debug('nav.request.handleResponseFromCache_ ', url, response);
  // Record the timing information.
  // Record responseStart and responseEnd times after loading from cache.
  timing['responseStart'] = timing['responseEnd'] = spf.now();
  // Also record navigationStart for navigate requests, consistent with
  // W3C PerformanceTiming for page loads.
  if (options.type == 'navigate') {
    timing['navigationStart'] = timing['startTime'];
  }
  if (options.onPart && response['type'] == 'multipart') {
    var parts = response['parts'];
    for (var i = 0; i < parts.length; i++) {
      options.onPart(url, parts[i]);
    }
  }
  spf.nav.request.done_(url, options, timing, response, false);
};


/**
 * Handles received headers from an XHR.
 * See {@link #send}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {Object} chunking Chunking status data.
 * @param {XMLHttpRequest} xhr The XHR of the current request.
 * @private
 */
spf.nav.request.handleHeadersFromXHR_ = function(url, chunking, xhr) {
  spf.debug.debug('nav.request.handleHeadersFromXHR_ ', url, xhr);
  var responseType = xhr.getResponseHeader('X-SPF-Response-Type') || '';
  var multipart = spf.string.contains(responseType.toLowerCase(), 'multipart');
  spf.debug.debug('    response is', (multipart ? '' : 'non-') + 'multipart');
  chunking.multipart = multipart;
};


/**
 * Handles a request chunk from an XHR as it arrives.
 * See {@link #send}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.nav.request.Options} options Configuration options
 * @param {Object} chunking Chunking status data.
 * @param {XMLHttpRequest} xhr The XHR of the current request.
 * @param {string} chunk The current request chunk.
 * @param {boolean=} opt_lastDitch Whether to parse the chunk as the final
 *     one, potentially handling malformed but valid responses.
 * @private
 */
spf.nav.request.handleChunkFromXHR_ = function(url, options, chunking,
                                               xhr, chunk, opt_lastDitch) {
  spf.debug.debug('nav.request.handleChunkFromXHR_ ',
                  url, {'extra': chunking.extra, 'chunk': chunk});
  // Processing chunks as they arrive requires multipart responses.
  if (!chunking.multipart) {
    spf.debug.debug('    skipping non-multipart response');
    return;
  }
  var text = chunking.extra + chunk;
  var parsed;
  try {
    parsed = spf.nav.response.parse(text, true, opt_lastDitch);
  } catch (err) {
    spf.debug.debug('    JSON parse failed', text);
    xhr.abort();
    if (options.onError) {
      options.onError(url, err);
    }
    return;
  }
  if (options.onPart) {
    for (var i = 0; i < parsed.parts.length; i++) {
      spf.debug.debug('    parsed part', parsed.parts[i]);
      options.onPart(url, parsed.parts[i]);
    }
  }
  chunking.complete = chunking.complete.concat(parsed.parts);
  chunking.extra = parsed.extra;
};


/**
 * Handles a request from an XHR.  Called for both chunked and regular requests.
 * See {@link #send}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.nav.request.Options} options Configuration options
 * @param {Object} timing Timing data.
 * @param {Object} chunking Chunking status data.
 * @param {XMLHttpRequest} xhr The XHR of the current request.
 * @private
 */
spf.nav.request.handleCompleteFromXHR_ = function(url, options, timing,
                                                  chunking, xhr) {
  spf.debug.debug('nav.request.handleCompleteFromXHR_ ',
                  url, {'extra': chunking.extra, 'complete': xhr.responseText});
  // Record the timing information from the XHR.
  if (xhr['timing']) {
    for (var t in xhr['timing']) {
      timing[t] = xhr['timing'][t];
    }
  }
  // Also record navigationStart for navigate requests, consistent with
  // W3C PerformanceTiming for page loads.
  if (options.type == 'navigate') {
    timing['navigationStart'] = timing['startTime'];
  }
  var parts;
  if (chunking.complete.length) {
    // If a multipart response was parsed on-the-fly via chunking, it should be
    // done.  However, check to see if there is any extra content, which could
    // occur if the server failed to end a reponse with a token.
    chunking.extra = spf.string.trim(chunking.extra);
    if (!chunking.extra) {
      // If the extra content was just whitespace, indicate parsing is done.
      parts = chunking.complete;
    } else {
      // Otherwise, parse the extra content as a last-ditch effort.
      var lengthBeforeLastDitch = chunking.complete.length;
      spf.nav.request.handleChunkFromXHR_(url, options, chunking,
                                          xhr, '', true);
      // If the last-ditch effort parsed additional sections successfully,
      // indicate parsing is done.  If not, then the extra content means
      // the response is invalid JSON; defer to attempt a full parse with
      // error handling below.
      if (chunking.complete.length > lengthBeforeLastDitch) {
        parts = chunking.complete;
      }
    }
  }
  if (!parts) {
    try {
      var parsed = spf.nav.response.parse(xhr.responseText);
      parts = parsed.parts;
    } catch (err) {
      spf.debug.debug('    JSON parse failed');
      if (options.onError) {
        options.onError(url, err);
      }
      return;
    }
    if (options.onPart && parts.length > 1) {
      // Only execute callbacks for parts that have not already been processed.
      // In case there is an edge case where some parts were parsed on-the-fly
      // but the entire response needed a full parse here, start iteration where
      // the chunk processing left off.  This is mostly a safety measure and
      // the number of chunks processed here should be 0.
      for (var i = chunking.complete.length; i < parts.length; i++) {
        spf.debug.debug('    parsed part', parts[i]);
        options.onPart(url, parts[i]);
      }
    }
  }
  var response;
  if (parts.length > 1) {
    response = /** @type {spf.MultipartResponse} */ ({
      'parts': parts,
      'type': 'multipart'
    });
  } else if (parts.length == 1) {
    response = /** @type {spf.SingleResponse} */(parts[0]);
  } else {
    response = /** @type {spf.SingleResponse} */({});
  }
  spf.nav.request.done_(url, options, timing, response, true);
};


/**
 * Finishes a request.
 * See {@link #send}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.nav.request.Options} options Configuration options.
 * @param {Object} timing Timing data.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The received SPF
 *   response object.
 * @param {boolean} cache Whether to store the response in the cache.
 * @private
 */
spf.nav.request.done_ = function(url, options, timing, response, cache) {
  spf.debug.debug('nav.request.done_', url, options, timing, response, cache);
  if (cache && options.method != 'POST') {
    // Cache the response for future requests.
    // Use the absolute URL without identifier to allow cached responses
    // from prefetching to apply to navigation.
    var absoluteUrl = spf.nav.url.absolute(url);
    spf.cache.set(absoluteUrl, response,  /** @type {number} */ (
        spf.config.get('cache-lifetime')));
  }
  // Set the timing for the response (avoid caching stale timing values).
  response['timing'] = timing;
  if (options.onSuccess) {
    options.onSuccess(url, response);
  }
};
