// Copyright 2013 Google Inc. All rights reserved.
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
goog.require('spf.array');
goog.require('spf.async');
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
 * - headers: optional map of headers to send with the request.
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
 *       "navigate-received" callback. The third argument is the XMLHttpRequest
 *       object for error
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
 * - withCredentials: optional flag to send credentials if true.
 *
 * @typedef {{
 *   method: (string|undefined),
 *   headers: (Object.<string>|undefined),
 *   onPart: (function(string, spf.SingleResponse)|undefined),
 *   onError: (function(string,
 *                   (Error|boolean),
 *                   (XMLHttpRequest|null|undefined))|undefined),
 *   onSuccess: (function(string,
 *                   (spf.SingleResponse|spf.MultipartResponse))|undefined),
 *   postData: spf.net.xhr.PostData,
 *   current: (string|null|undefined),
 *   referer: (string|null|undefined),
 *   type: (string|undefined),
 *   withCredentials: (boolean|undefined)
 * }}
 */
spf.nav.request.Options;


/**
 * Requests a URL using the SPF protocol and parses the response.  If
 * successful, the URL and response object are passed to the optional
 * `onSuccess` callback.  If not, the URL is passed to the optional
 * `onError` callback.  If chunked response are being used, the
 * URL and each partial response object will be passed to the optional
 * `onPart` callback as they are received.
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
  timing['spfPrefetched'] = !!cached && cached.type == 'prefetch';
  timing['spfCached'] = !!cached;
  if (cached) {
    var response = /** @type {spf.SingleResponse|spf.MultipartResponse} */ (
        cached.response);
    // To ensure a similar execution pattern as an XHR, ensure the
    // cache response is returned asynchronously.
    var handleCache = spf.bind(spf.nav.request.handleResponseFromCache_, null,
                               url, options, timing, cached.key, response);
    // When WebKit browsers are in a background tab, setTimeout calls are
    // deprioritized to execute with a 1s delay.  Avoid this by using
    // postMessage to schedule execution; see spf.async.delay for details.
    spf.async.defer(handleCache);
    // Return null because no XHR is made.
    return null;
  } else {
    spf.debug.debug('    sending XHR');
    var headers = {};
    // Set headers provided by global config first.
    var configHeaders = /** @type {Object.<string>} */ (
      spf.config.get('request-headers'));
    if (configHeaders) {
      for (var key in configHeaders) {
        var value = configHeaders[key];
        // Treat undefined and null values as equivalent to an empty string.
        // Note that undefined == null.
        headers[key] = (value == null) ? '' : String(value);
      }
    }
    // Set headers provided by options second, to allow overrides.
    if (options.headers) {
      for (var key in options.headers) {
        var value = options.headers[key];
        // Treat undefined and null values as equivalent to an empty string.
        // Note that undefined == null.
        headers[key] = (value == null) ? '' : String(value);
      }
    }
    // Allow empty referrer values in history.
    // Note that undefined == null.
    if (options.referer != null) {
      headers['X-SPF-Referer'] = options.referer;
    }
    if (options.current != null) {
      headers['X-SPF-Previous'] = options.current;
    }
    // As an advanced option, allow request identification via a header.  This
    // will allow removal of the default identification via URL:
    //     GET /path
    //     Accept: application/json
    //     X-SPF-Request: navigate
    // instead of:
    //     GET /path?spf=navigate
    // But, it comes with 2 extra restrictions:
    // (1) The server MUST return a `Vary` header on some value that is
    // different between SPF requests and default browser requests to avoid
    // caching problems.  The best way to manage this is usually via the
    // `Accept` header.  Since JSON is used for transport of SPF responses,
    // a request that sends a value of `application/json` will work and will
    // be different than standard requests.  A list of defaults used by
    // various browser can be found at
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation.
    // For the quest shown above, the response should then include:
    //      Vary: Accept
    // (2) The server MUST use SPF-based redirection, as custom headers (i.e.
    // the `X-SPF-Request` header) are typically not propgated by browsers
    // during 30X HTTP redirection.
    var headerId = /** @type {?string} */ (
        spf.config.get('advanced-header-identifier'));
    if (headerId) {
      headers['X-SPF-Request'] = headerId.replace('__type__', options.type);
      headers['Accept'] = 'application/json';
    }
    var chunking = new spf.nav.request.Chunking_();
    var handleHeaders = spf.bind(spf.nav.request.handleHeadersFromXHR_, null,
                                 url, chunking);
    var handleChunk = spf.bind(spf.nav.request.handleChunkFromXHR_, null,
                               url, options, timing, chunking);
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

    if (options.withCredentials) {
      xhrOpts.withCredentials = options.withCredentials;
    }

    // As an advanced option, allow XHR requests to enforce JSON responses.
    // This can make response parsing more efficient by reducing contention on
    // the main thread (especially for very large responses), but as a
    // side-effect, it removes the ability to parse chunked multipart responses
    // on-the-fly.
    if (spf.config.get('advanced-response-type-json')) {
      xhrOpts.responseType = 'json';
    }
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
    spf.array.each(parts, function(part) {
      if (!part['timing']) {
        part['timing'] = {};
      }
      part['timing']['spfCached'] = !!timing['spfCached'];
      part['timing']['spfPrefetched'] = !!timing['spfPrefetched'];
      options.onPart(url, part);
    });
  }
  spf.nav.request.done_(url, options, timing, response, updateCache);
};


/**
 * Handles received headers from an XHR.
 * See {@link #send}.
 *
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {spf.nav.request.Chunking_} chunking Chunking data.
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
 * @param {Object} timing Timing data.
 * @param {spf.nav.request.Chunking_} chunking Chunking data.
 * @param {XMLHttpRequest} xhr The XHR of the current request.
 * @param {string} chunk The current request chunk.
 * @param {boolean=} opt_lastDitch Whether to parse the chunk as the final
 *     one, potentially handling malformed but valid responses.
 * @private
 */
spf.nav.request.handleChunkFromXHR_ = function(url, options, timing, chunking,
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
      options.onError(url, err, xhr);
    }
    return;
  }
  if (options.onPart) {
    spf.array.each(parsed.parts, function(part) {
      spf.debug.debug('    parsed part', part);
      if (!part['timing']) {
        part['timing'] = {};
      }
      part['timing']['spfCached'] = !!timing['spfCached'];
      part['timing']['spfPrefetched'] = !!timing['spfPrefetched'];
      options.onPart(url, part);
    });
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
 * @param {spf.nav.request.Chunking_} chunking Chunking data.
 * @param {XMLHttpRequest} xhr The XHR of the current request.
 * @private
 */
spf.nav.request.handleCompleteFromXHR_ = function(url, options, timing,
                                                  chunking, xhr) {
  if (xhr.responseType == 'json') {
    spf.debug.debug('nav.request.handleCompleteFromXHR_ ', url, xhr.response);
  } else {
    spf.debug.debug('nav.request.handleCompleteFromXHR_ ', url,
                    {'extra': chunking.extra, 'complete': xhr.responseText});
  }

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
    } else if (window.performance && window.performance.timing) {
      // Normalize relative Resource Timing values as
      // Navigation Timing absolute values using navigationStart as base.
      var navigationStart = window.performance.timing.navigationStart;

      // Use resource timing data (RT) only if RT.startTime is later than
      // the one provided by SPF when request was initiated.
      // This is specifically affecting Chrome 40+. See http://crbug.com/375388
      var startTime = navigationStart + xhr['resourceTiming']['startTime'];
      if (startTime >= timing['startTime']) {
        for (var metric in xhr['resourceTiming']) {
          var value = xhr['resourceTiming'][metric];
          if (value !== undefined && (spf.string.endsWith(metric, 'Start') ||
              spf.string.endsWith(metric, 'End') || metric == 'startTime')) {
            timing[metric] = navigationStart + Math.round(value);
          }
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
      spf.nav.request.handleChunkFromXHR_(url, options, timing, chunking,
                                          xhr, '', true);
    }
  }

  var parts;
  if (xhr.responseType == 'json') {
    // If using the JSON `responseType`, parsing is complete and no chunking
    // has been handled on-the-fly.
    if (!xhr.response) {
      spf.debug.debug('    JSON parse failed');
      if (options.onError) {
        options.onError(url, new Error('JSON response parsing failed'), xhr);
      }
      return;
    }
    parts = spf.nav.response.extract(spf.array.toArray(xhr.response));
  } else {
    // Otherwise, parsing may need to be done.  Always attempt a full parse with
    // error handling. A multipart response parsed on-the-fly via chunking may
    // be invalid JSON if the response is truncated early.  (If truncated just
    // after a token, the chunking.extra value will be empty and no additional
    // chunk parsing will be done, but the overall response will stil be
    // invalid.)
    try {
      var parsed = spf.nav.response.parse(xhr.responseText);
      parts = parsed.parts;
    } catch (err) {
      spf.debug.debug('    JSON parse failed');
      if (options.onError) {
        options.onError(url, err, xhr);
      }
      return;
    }
  }

  if (options.onPart && parts.length > 1) {
    // Only execute callbacks for parts that have not already been processed.
    // In case there is an edge case where some parts were parsed on-the-fly
    // but the entire response needed a full parse here, start iteration where
    // the chunk processing left off.  This is mostly a safety measure and
    // the number of chunks processed here should be 0.
    for (var i = chunking.complete.length; i < parts.length; i++) {
      spf.debug.debug('    parsed part', parts[i]);
      var part = parts[i];
      if (!part['timing']) {
        part['timing'] = {};
      }
      part['timing']['spfCached'] = !!timing['spfCached'];
      part['timing']['spfPrefetched'] = !!timing['spfPrefetched'];
      options.onPart(url, part);
    }
  }
  var response;
  if (parts.length > 1) {
    var cacheType;
    spf.array.each(parts, function(part) {
      if (part['cacheType']) {
        cacheType = part['cacheType'];
      }
    });
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
      response['cacheKey'] = cacheKey;
      spf.nav.request.setCacheObject_(cacheKey, response, options.type || '');
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

  var cacheValue = null;

  // Find the first cached object and break loop early when found.
  spf.array.some(keys, function(key) {
    var obj = spf.cache.get(key);
    if (obj) {
      cacheValue = {
        key: key,
        response: obj['response'],
        type: obj['type']
      };
    }
    return !!obj;
  });

  return cacheValue;
};


/**
 * Set a response object into cache with the given key.
 *
 * @param {string} cacheKey The base cache key for the requested URL.
 * @param {spf.SingleResponse|spf.MultipartResponse} response The received SPF
 *     response object.
 * @param {string} type The type of request this cache entry was set with.
 * @private
 */
spf.nav.request.setCacheObject_ = function(cacheKey, response, type) {
  var cacheValue = {
    'response': response,
    'type': type
  };
  spf.cache.set(cacheKey, cacheValue,  /** @type {number} */ (
      spf.config.get('cache-lifetime')));
};


/**
 * Container for holding data to track chunking for an SPF request.
 *
 * @constructor
 * @struct
 * @private
 */
spf.nav.request.Chunking_ = function() {
  /**
   * Whether the request is multipart.
   * @type {boolean}
   */
  this.multipart = false;
  /**
   * Any extra text from a previous chunk that was not successfully
   * parsed on its own, usually due to an incomplete part split across
   * chunk boundaries; combined with the text of a current chunk to complete.
   * @type {string}
   */
  this.extra = '';
  /**
   * Complete parts that have been successfully parsed.
   * @type {!Array}
   */
  this.complete = [];
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
