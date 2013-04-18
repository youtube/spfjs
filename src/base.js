/**
 * @fileoverview The base SPF namespace.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf');


/**
 * @define {boolean} DEBUG is provided as a convenience so that debugging code
 * that should not be included in a production build can be easily removed
 * by the compiler when "--define spf.DEBUG=false" is specified.  To use,
 * place debugging code inside an "if (spf.DEBUG)" conditional.
 */
spf.DEBUG = true;


/**
 * Default configuration values.
 * @type {Object.<string, string|number|Function>}
 */
spf.defaults = {
  'url-identifier': '?spf=1',
  'link-class': 'spf-link',
  'nolink-class': null, // If needed, "spf-nolink" is recommended.
  'request-timeout': 0,
  'cache-lifetime': 600000,  // 10 minutes in milliseconds.
  'navigate-started-callback': null,
  'navigate-history-callback': null,
  'navigate-received-callback': null,
  'navigate-processed-callback': null,
  'load-received-callback': null,
  'load-processed-callback': null,
  'transition-class': 'spf-transition',
  'transition-duration': 425,
  'transition-forward-parent-class': 'spf-transition-forward',
  'transition-reverse-parent-class': 'spf-transition-reverse',
  'transition-current-child-class': 'spf-current',
  'transition-forward-child-class': 'spf-forward',
  'transition-reverse-child-class': 'spf-reverse'
};


/**
 * Current configuration values.
 * @type {Object}
 */
spf.config = {};


/**
 * @return {number} An integer value representing the number of milliseconds
 *     between midnight, January 1, 1970 and the current time.
 */
spf.now = function() {
  // Unary plus operator converts its operand to a number which in the case of
  // a date is done by calling getTime().
  return +new Date();
};


/**
 * Gets a unique key for an object.  Mutates the object to store the key so
 * that multiple calls for the same object will return the same key.
 *
 * @param {Object} obj The object to get a unique key for.
 * @return {string} The unique key.
 */
spf.getKey = function(obj) {
  return obj['spf-key'] ||
      (obj['spf-key'] = spf.now() + '-' + (++spf.counter_));
};


/**
 * @type {number}
 * @private
 */
spf.counter_ = 0;
