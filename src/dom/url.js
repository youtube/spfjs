/**
 * @fileoverview Element-based URL manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.dom.url');


/**
 * Converts a relative URL to absolute based on the current document domain.
 *
 * @param {string} relative A relative URL.
 * @return {string} An absolute URL.
 */
spf.dom.url.absolute = function(relative)  {
  var aEl = document.createElement('a');
  aEl.href = relative;
  // Note: this automatic conversion does not work in IE7 and under.  If
  // support is needed in the future, using innerHTML to create an <a> element
  // as a child of a <div> will work, but the URL should have special
  // HTML characaters escaped.
  return aEl.href;
};
