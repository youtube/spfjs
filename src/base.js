// Copyright 2012 Google Inc. All Rights Reserved.

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
  'request-timeout': 4000,
  'callback-click': null,
  'callback-navigate': null,
  'callback-load': null,
  'callback-done': null,
  'transition-class': 'spf-transition',
  'transition-duration': 500,
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
