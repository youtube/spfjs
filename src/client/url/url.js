// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview URL manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 * @suppress {missingProperties}
 */

goog.provide('spf.url');

goog.require('spf.array');
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
 * @return {string} An absolute URL (with hash removed, if possible).
 */
spf.url.absolute = function(relative, opt_keepHash) {
  var utils = spf.url.utils(relative);
  return opt_keepHash ? utils.href : spf.url.unhash(utils.href);
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
 * Adds the SPF identifier to a URL, to be used in requests.  If the
 * identifier contains `__type__` then that value will be replaced
 * with the value of `opt_type`.
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

    // Split the URL.
    var hashParts = spf.string.partition(url, '#');
    var queryParts = spf.string.partition(hashParts[0], '?');
    var path = queryParts[0];
    var querySep = queryParts[1];
    var queryVal = queryParts[2];
    var hashSep = hashParts[1];
    var hashVal = hashParts[2];

    // Inject the identifier.
    if (spf.string.startsWith(ident, '?')) {
      // If using a query-based identifier, append the identifier to the
      // existing query string.
      // For "?ident":
      //     /path -> path?ident
      //     /path?query -> path?query&ident
      if (querySep) {
        ident = ident.replace('?', '&');
      }
      queryVal += ident;
    } else if (spf.string.startsWith(ident, '.')) {
      // If using an extension-based identifier, replace the existing
      // extension with the identifier.  If no extension exists, the
      // identifier is appended.  However, if the URL specifies a directory
      // (i.e. it ends with "/"), then append "index" to the URL first.
      // For ".ident":
      //     /path -> /path.ident
      //     /path.ext -> /path.ident
      //     /path/ -> /path/index.ident
      if (spf.string.endsWith(path, '/')) {
        ident = 'index' + ident;
      } else {
        var ext = path.lastIndexOf('.');
        if (ext > -1) {
          path = path.substring(0, ext);
        }
      }
      path += ident;
    } else {
      // Finally, if using any other identifier, just append the identifier,
      // preventing duplicate "/" in the URL.
      // For "/ident":
      //     /path -> /path/ident
      //     /path/ -> /path/ident
      // For "_ident":
      //     /path -> /path_ident
      //     /path/ -> /path/_ident
      if (spf.string.endsWith(path, '/') && spf.string.startsWith(ident, '/')) {
        ident = ident.substring(1);
      }
      path += ident;
    }

    // Re-assemble the URL.
    url = path + querySep + queryVal + hashSep + hashVal;
  }
  return url;
};


/**
 * Appends the parameters to the url. Any existing parameters or hashes are
 * maintained.
 *
 * @param {string} url A URL.
 * @param {!Object.<string, string>} parameters An object with new parameters
 *    as key/value pairs.
 * @return {string} A new URL with the parameters included.
 */
spf.url.appendParameters = function(url, parameters) {
  var result = spf.string.partition(url, '#');
  url = result[0];
  var delim = spf.string.contains(url, '?') ? '&' : '?';
  for (var key in parameters) {
    url += delim + key;
    if (parameters[key]) {
      url += '=' + parameters[key];
    }
    delim = '&';
  }
  // Reattach the hash.
  return url + result[1] + result[2];
};


/**
 * Removes a list of parameters from a given url.
 *
 * @param {string} url A URL.
 * @param {!Array.<string>} parameters A list of parameter keys to remove.
 * @return {string} A new URL with the parameters removed.
 */
spf.url.removeParameters = function(url, parameters) {
  var result = spf.string.partition(url, '#');
  url = result[0];
  spf.array.each(parameters, function(param) {
    // Strip all parameters matching the param key.
    var regex = new RegExp('([?&])' + param + '(?:=[^&]*)?(?:(?=[&])|$)', 'g');
    url = url.replace(regex, function(_, delim) {
      return delim == '?' ? delim : '';
    });
  });
  // Remove an unecessary trailing question marks.
  if (spf.string.endsWith(url, '?')) {
    url = url.slice(0, -1);
  }
  // Reattach the hash.
  return url + result[1] + result[2];
};


/**
 * Appends a configurable set of parameters that should persist across URLs.
 *
 * @param {string} url A URL.
 * @return {string} A new URL with the persistent parameters included.
 */
spf.url.appendPersistentParameters = function(url) {
  // Get the param config of the form "abc=def&foo=bar"
  var parameterConfig = spf.config.get('advanced-persistent-parameters') || '';
  var result = spf.string.partition(url, '#');
  url = result[0];
  var delim = spf.string.contains(url, '?') ? '&' : '?';
  // Append the persistent parameters to the URL.
  url += parameterConfig ? delim + parameterConfig : '';
  // Reattach the hash.
  return url + result[1] + result[2];
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
 * Removes a hash from a URL.
 *
 * @param {string} url A URL.
 * @return {string}  A URL without a hash, if possible.
 */
spf.url.unhash = function(url) {
  var res = spf.string.partition(url, '#');
  return res[0];
};
