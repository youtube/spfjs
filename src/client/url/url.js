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
 *
 * @param {string} relative A relative URL.
 * @return {string} An absolute URL.
 */
spf.url.absolute = function(relative) {
  var aEl = document.createElement('a');
  aEl.href = relative;
  return aEl.href;
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
    if (spf.string.startsWith(ident, '?') &&
        spf.string.contains(url, '?')) {
      url += ident.replace('?', '&');
    } else {
      url += ident;
    }
  }
  return url;
};


/**
 * Converts an absolute URL to protocol-relative (e.g. no http: or https:).
 * Has no effect on relative URLs.
 *
 * @param {string} absolute An absolute URL.
 * @return {string} An protocol-relative URL, if possible.
 */
spf.url.unprotocol = function(absolute) {
  return absolute.replace(/^[a-zA-Z]+:\/\//, '//');
};
