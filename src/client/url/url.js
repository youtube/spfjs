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
 *
 * @param {string} relative A relative URL.
 * @param {boolean=} opt_keepHash  Whether to keep any hash in the URL,
 *     if one exists.  Defaults to false.
 * @return {string} An absolute URL (with fragment removed, if possible).
 */
spf.url.absolute = function(relative, opt_keepHash) {
  var utils = spf.url.utils(relative);
  return opt_keepHash ? utils.href : spf.url.unfragment(utils.href);
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
    ident = ident.replace('__type__', type);
    var result = spf.url.splitFragment_(url);
    url = result[0];

    // The identifier may not be a parameter, but an extension.
    if (spf.string.startsWith(ident, '?') &&
        spf.string.contains(url, '?')) {
      ident = ident.replace('?', '&');
    }

    // Inject the idenitifier and re-add the fragment.
    url += ident + result[1];
  }
  return url;
};


/**
 * Appends the parameters to the url. Any existing parameters or fragments are
 * maintained.
 *
 * @param {string} url A URL.
 * @param {!Object.<string, string>} parameters An object with new parameters
 *    as key/value pairs.
 * @return {string} A new URL with the parameters included.
 */
spf.url.appendParameters = function(url, parameters) {
  var result = spf.url.splitFragment_(url);
  url = result[0];
  var delim = spf.string.contains(url, '?') ? '&' : '?';
  for (var key in parameters) {
    url += delim + key;
    if (parameters[key]) {
      url += '=' + parameters[key];
    }
    delim = '&';
  }
  // Reattach the fragments.
  return url + result[1];
};


/**
 * Removes a list of parameters from a given url.
 *
 * @param {string} url A URL.
 * @param {!Array.<string>} parameters A list of parameter keys to remove.
 * @return {string} A new URL with the parameters removed.
 */
spf.url.removeParameters = function(url, parameters) {
  // Remove any fragments from consideration
  var result = spf.url.splitFragment_(url);
  url = result[0];

  for (var i = 0; i < parameters.length; i++) {
    var param = parameters[i];

    // Strip all parameters matching the param key.
    var regex = new RegExp('([?&])' + param + '(?:=[^&]*)?(?:(?=[&])|$)', 'g');
    url = url.replace(regex, function(_, delim) {
      return delim == '?' ? delim : '';
    });
  }

  // Remove an unecessary trailing question marks.
  if (spf.string.endsWith(url, '?')) {
    url = url.slice(0, -1);
  }

  return url + result[1];
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
  var res = spf.string.partition(url, '#');
  return res[0];
};


/**
 * Splits the fragment section from the URL if present.
 *
 * @param {string} url A URL.
 * @return {Array.<string>} An array containing the URL without the fragment and
 *    the fragment including a hash.
 * @private
 */
spf.url.splitFragment_ = function(url) {
  var res = spf.string.partition(url, '#');
  return [res[0], res[1] + res[2]];
};
