// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

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
goog.require('spf.net.xhr');
goog.require('spf.string');
goog.require('spf.tracing');
goog.require('spf.url');


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
 * - current: optional current page URL, without the SPF identifier.
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
 *   current: (string|null|undefined),
 *   referer: (string|null|undefined),
 *   type: (string|undefined)
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
  // Add the SPF identifier, to be used for sending the request.
  var requestUrl = spf.url.absolute(spf.url.identify(url, options.type));
  spf.debug.debug('    request url ', requestUrl);
  // Record a the time before sending the request or loading from cache.
  // The startTime is consistent with W3C PerformanceResourceTiming for XHRs.
  var timing = {};
  // Keep actual absolute SPF request url info.
  timing['spfUrl'] = requestUrl;
  timing['startTime'] = spf.now();
  // Try to find a cached response for the request before sending a new XHR.
  // Record fetchStart time before loading from cache. If no cached response
  // is found, this value will be replaced with the one provided by the XHR.
  timing['fetchStart'] = timing['startTime'];
  var cacheKey = spf.nav.request.getCacheKey_(url, options.current, null,
                                              options.type, false);
  // Use the absolute URL without identifier to allow cached responses
  // from prefetching to apply to navigation.
  var cached = spf.nav.request.getCacheObject_(cacheKey, options.current);
  timing['spfCached'] = !!cached;
  if (cached) {
    var response = /** @type {spf.SingleResponse|spf.MultipartResponse} */ (
        cached.response);
    // To ensure a similar execution pattern as an XHR, ensure the
    // cache response is returned asynchronously.
    var handleCache = spf.bind(spf.nav.request.handleResponseFromCache_, null,
                               url, options, timing, cached.key, response);
    setTimeout(handleCache, 0);
    // Return null because no XHR is made.
    return null;
  } else {
    spf.debug.debug('    sending XHR');
    var headers = {};
    // Compare against "undefined" to allow empty referrer values in history.
    if (options.referer != undefined) {
      headers['X-SPF-Referer'] = options.referer;
    }
    if (options.current) {
      headers['X-SPF-Previous'] = options.current;
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
 * @param {string} cacheKey The cache key.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The cached SPF
 *     response object.
 * @private
 */
spf.nav.request.handleResponseFromCache_ = function(url, options, timing,
                                                    cacheKey, response) {
  spf.debug.debug('nav.request.handleResponseFromCache_ ', url, response);
  var updateCache = false;
  // Record the timing information.
  // Record responseStart and responseEnd times after loading from cache.
  timing['responseStart'] = timing['responseEnd'] = spf.now();
  // Also record navigationStart for navigate requests, consistent with
  // W3C PerformanceTiming for page loads.
  if (options.type && spf.string.startsWith(options.type, 'navigate')) {
    timing['navigationStart'] = timing['startTime'];
    // Record that this prefetched response is a cache hit.
    timing['spfPrefetchType'] = 'cache';
    // If this cached response was a navigate and a unified cache is not being
    // used, then it was from prefetch-based caching and is only eligible to
    // be used once.
    if (!spf.config.get('cache-unified')) {
      spf.cache.remove(cacheKey);
      // Ensure the response will be stored in the history-based caching.
      updateCache = true;
    }
  }
  if (options.onPart && response['type'] == 'multipart') {
    var parts = response['parts'];
    for (var i = 0; i < parts.length; i++) {
      options.onPart(url, parts[i]);
    }
  }
  spf.nav.request.done_(url, options, timing, response, updateCache);
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

  // Record timings from Resource Timing API.
  if (xhr['resourceTiming']) {
    if (options.type == 'load') {
      // Record relative timings.
      for (var key in xhr['resourceTiming']) {
        timing[key] = xhr['resourceTiming'][key];
      }
    } else {
      // Normalize startTime as base timing, accounting for the 2 clocks:
      // one from JS main thread when startTime was first set as spf.now()
      // with absolute time then another one from Resource Timing API which is
      // relative to the time resource was put in the fetch queue. E.g.:
      // 1. timing.startTime = now() // e.g.: 12340000
      // 2. xhr is requested (put in browser fetch queue)
      // 3. 50ms later resource is actually requested, i.e: res.startTime = 50
      // 4. normalize startTime as timing.startTime + res.startTime // 12340050
      // 5. then timing.navigationStart = timing.startTime // 12340050
      var startTime = timing['startTime'] = timing['startTime'] +
          Math.round(xhr['resourceTiming']['startTime'] || 0);
      // Normalize relative Resource Timing values as
      // Navigation Timing absolute values.
      for (var metric in xhr['resourceTiming']) {
        var value = xhr['resourceTiming'][metric];
        if (value !== undefined && (spf.string.endsWith(metric, 'Start') ||
            spf.string.endsWith(metric, 'End'))) {
          timing[metric] = startTime + Math.round(value);
        }
      }
    }
  }

  // Also record navigationStart for all requests but load type, consistent with
  // W3C PerformanceTiming for page loads.
  if (options.type != 'load') {
    timing['navigationStart'] = timing['startTime'];
  }

  if (chunking.complete.length) {
    // If a multipart response was parsed on-the-fly via chunking, it should be
    // done.  However, check to see if there is any extra content, which could
    // occur if the server failed to end a reponse with a token.
    chunking.extra = spf.string.trim(chunking.extra);
    if (chunking.extra) {
      // If extra content exists, parse it as a last-ditch effort.
      spf.nav.request.handleChunkFromXHR_(url, options, chunking,
                                          xhr, '', true);
    }
  }
  // Always attempt a full parse with error handling.
  // A multipart response parsed on-the-fly via chunking may be invalid JSON if
  // the response is truncated early.  (If truncated just after a token,
  // the chunking.extra value will be empty and no additional chunk parsing
  // will be done, but the overall response will stil be invalid.)
  var parts;
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
  var response;
  if (parts.length > 1) {
    var cacheType;
    for (var i = 0, l = parts.length; i < l; i++) {
      var part = parts[i];
      if (part['cacheType']) {
        cacheType = part['cacheType'];
      }
    }
    response = /** @type {spf.MultipartResponse} */ ({
      'parts': parts,
      'type': 'multipart'
    });
    if (cacheType) {
      response['cacheType'] = cacheType;
    }
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
    var cacheKey = spf.nav.request.getCacheKey_(url, options.current,
                                                response['cacheType'],
                                                options.type, true);
    if (cacheKey) {
      spf.nav.request.setCacheObject_(cacheKey, response);
    }
  }
  // Set the timing for the response (avoid caching stale timing values).
  response['timing'] = timing;
  if (options.onSuccess) {
    options.onSuccess(url, response);
  }
};


/**
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {string|null|undefined} opt_current The current page's URL. Some
 *     responses are only cacheable for limited origin URLs.
 * @param {string|null|undefined} opt_cacheType The type of cache used for
 *     this request (e.g. "global", "path", "url").
 * @param {string=} opt_requestType Type of request (e.g. "navigate", "load",
 *     etc).
 * @param {boolean=} opt_set Whether getting or setting the cache.
 * @return {string} The cache key for the URL.
 * @private
 */
spf.nav.request.getCacheKey_ = function(url, opt_current, opt_cacheType,
                                      opt_requestType, opt_set) {
  // Use the absolute URL without identifier to ensure consistent caching.
  var absoluteUrl = spf.url.absolute(url);
  var cacheKey;
  if (spf.config.get('cache-unified')) {
    // If using a unified cache, the key is just the URL to allow cached
    // responses from prefetching to apply to navigation, etc.  This also
    // means that load requests are cached unless they are sent via POST.
    cacheKey = absoluteUrl;
  } else {
    // Otherwise, caching is split between history and prefetching by using
    // a key prefix.  Regular non-history navigation is only eligible for
    // prefetch-based caching.
    if (opt_requestType == 'navigate-back' ||
        opt_requestType == 'navigate-forward') {
      // For back/forward, get and set to history cache.
      cacheKey = 'history ' + absoluteUrl;
    } else if (opt_requestType == 'navigate') {
      // For navigation, get from prefetch cache, but set to history cache.
      cacheKey = (opt_set ? 'history ' : 'prefetch ') + absoluteUrl;
    } else if (opt_requestType == 'prefetch') {
      // For prefetching, never get, only set to prefetch cache.
      cacheKey = opt_set ? ('prefetch ' + absoluteUrl) : '';
    }
  }

  if (opt_current && opt_cacheType == 'url') {
    cacheKey += ' previous ' + opt_current;
  } else if (opt_current && opt_cacheType == 'path') {
    cacheKey += ' previous ' + spf.url.path(opt_current);
  }

  return cacheKey || '';
};


/**
 * Get an object from cache if available.
 *
 * @param {string} cacheKey The base cache key for the requested URL.
 * @param {string|null|undefined} opt_current The current page's URL. Some
 *     responses are only cacheable for limited origin URLs.
 * @return {Object.<string, *>} The response object if found in the cache.
 * @private
 */
spf.nav.request.getCacheObject_ = function(cacheKey, opt_current) {
  var keys = [];
  if (opt_current) {
    keys.push(cacheKey + ' previous ' + opt_current);
    keys.push(cacheKey + ' previous ' + spf.url.path(opt_current));
  }
  keys.push(cacheKey);

  for (var i = 0, l = keys.length; i < l; i++) {
    var cached = spf.cache.get(keys[i]);

    if (cached) {
      return {
        key: keys[i],
        response: cached
      };
    }
  }
  return null;
};


/**
 * Set a response object into cache with the given key.
 *
 * @param {string} cacheKey The base cache key for the requested URL.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The received SPF
 *     response object.
 * @private
 */
spf.nav.request.setCacheObject_ = function(cacheKey, response) {
  spf.cache.set(cacheKey, response,  /** @type {number} */ (
      spf.config.get('cache-lifetime')));
};


if (spf.tracing.ENABLED) {
  (function() {
    var request = spf.nav.request;
    request.send = spf.tracing.instrument(
        request.send, 'spf.nav.request.send');
    request.handleResponseFromCache_ = spf.tracing.instrument(
        request.handleResponseFromCache_,
        'spf.nav.request.handleResponseFromCache_');
    request.handleHeadersFromXHR_ = spf.tracing.instrument(
        request.handleHeadersFromXHR_,
        'spf.nav.request.handleHeadersFromXHR_');
    request.handleChunkFromXHR_ = spf.tracing.instrument(
        request.handleChunkFromXHR_,
        'spf.nav.request.handleChunkFromXHR_');
    request.handleCompleteFromXHR_ = spf.tracing.instrument(
        request.handleCompleteFromXHR_,
        'spf.nav.request.handleCompleteFromXHR_');
    request.done_ = spf.tracing.instrument(
        request.done_, 'spf.nav.request.done_');
  })();
}
