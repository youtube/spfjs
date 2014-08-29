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
 * See {@link https://developer.mozilla.org/en-US/docs/Web/API/URLUtils}.
 *
 * @typedef {{
 *   href: string,
 *   protocol: string,
 *   host: string,
 *   hostname: string,
 *   port: string,
 *   pathname: string,
 *   search: string,
 *   hash: string,
 *   username: string,
 *   password: string,
 *   origin: string
 * }}
 */
spf.url.URLUtils;


/**
 * Returns a URLUtils compatible object for a given url. For the interface, see
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/URLUtils}.
 *
 * @param {string} url A relative or absolute URL.
 * @return {spf.url.URLUtils} The URLUtils object.
 */
spf.url.utils = function(url) {
  var aEl = document.createElement('a');
  // If the URL is relative, IE will not populate host/port parameters.
  aEl.href = url;
  // Assigning the absolute URL back to the href value solves this IE bug.
  aEl.href = aEl.href;
  var utils = {
    href: aEl.href,
    protocol: aEl.protocol,
    host: aEl.host,
    hostname: aEl.hostname,
    port: aEl.port,
    pathname: aEl.pathname,
    search: aEl.search,
    hash: aEl.hash,
    username: aEl.username,
    password: aEl.password
  };
  // The origin is the combination of scheme, domain, and port.
  utils.origin = utils.protocol + '//' + utils.host;
  // IE does not include the leading slash on a path. So if the path is
  // available, but no leading slash is present, prepend one.
  if (!utils.pathname || utils.pathname[0] != '/') {
    utils.pathname = '/' + utils.pathname;
  }
  return utils;
};


/**
 * Converts a relative URL to absolute based on the current document domain.
 * Also removes the fragment from the URL, if one exists.
 *
 * @param {string} relative A relative URL.
 * @return {string} An absolute URL (with fragment removed, if possible).
 */
spf.url.absolute = function(relative) {
  var utils = spf.url.utils(relative);
  return spf.url.unfragment(utils.href);
};


/**
 * Returns the path portion of a given URL.
 *
 * @param {string} url A relative or absolute URL.
 * @return {string} The path portion of the URL.
 */
spf.url.path = function(url) {
  var utils = spf.url.utils(url);
  return utils.pathname;
};


/**
 * Returns the origin of a given URL (scheme + domain + port).
 *
 * @param {string} url A relative or absolute URL.
 * @return {string} The origin of the URL.
 */
spf.url.origin = function(url) {
  var utils = spf.url.utils(url);
  return utils.origin;
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
