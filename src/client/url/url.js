// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview URL manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.url');

goog.require('spf.config');
goog.require('spf.string');


/**
 * Converts a relative URL to absolute based on the current document domain.
 * Also removes the fragment from the URL, if one exists.
 *
 * @param {string} relative A relative URL.
 * @return {string} An absolute URL (with fragment removed, if possible).
 */
spf.url.absolute = function(relative) {
  var aEl = document.createElement('a');
  aEl.href = relative;
  return spf.url.unfragment(aEl.href);
};


/**
 * Returns just the path portion of a given URL, relative or absolute.
 *
 * @param {string} url The full URL.
 * @return {string} The path portion of the URL.
 */
spf.url.path = function(url) {
  var aEl = document.createElement('a');
  aEl.href = url;
  var path = aEl.pathname;
  // IE does not include the leading slash on a path. So if the path is
  // available, but no leading slash is present, prepend one.
  if (!!path && path[0] == '/') {
    return path;
  } else {
    return '/' + path;
  }
};


/**
 * Appends the SPF identifier to a URL, to be used in requests.  If the
 * identifier contains {@code __type__} then that value will be replaced
 * with the value of {@code opt_type}.
 *
 * @param {string} url A URL.
 * @param {string=} opt_type An optional type for identification.
 * @return {string} An identified URL.
 */
spf.url.identify = function(url, opt_type) {
  var ident = /** @type {string} */ (spf.config.get('url-identifier')) || '';
  if (ident) {
    var type = opt_type || '';
    var frag = '';
    if (spf.string.contains(url, '#')) {
      var res = spf.string.bisect(url, '#');
      url = res[0];
      frag = '#' + res[1];
    }
    ident = ident.replace('__type__', type);
    if (spf.string.startsWith(ident, '?') &&
        spf.string.contains(url, '?')) {
      url += ident.replace('?', '&');
    } else {
      url += ident;
    }
    url += frag;
  }
  return url;
};


/**
 * Converts an absolute URL to protocol-relative (e.g. no http: or https:).
 * Has no effect on relative URLs.
 *
 * @param {string} url An absolute URL.
 * @return {string} An protocol-relative URL, if possible.
 */
spf.url.unprotocol = function(url) {
  return url.replace(/^[a-zA-Z]+:\/\//, '//');
};


/**
 * Removes a fragment from a URL.
 *
 * @param {string} url A URL.
 * @return {string}  A URL without a fragment, if possible.
 */
spf.url.unfragment = function(url) {
  var res = spf.string.bisect(url, '#');
  return res[0];
};
