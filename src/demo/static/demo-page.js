/**
 * @fileoverview Sample JavaScript for "Demo Pages" area of the SPF demo app.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// This file only exists to demonstrate external JS being loaded.

var demo = demo || {};

/**
 * Simple central logging function for the demo app.
 */
demo.log = function(msg) {
  if (window.console) {
    window.console.log('[demo] ' + msg);
  }
};

/**
 * The demo app namespace for the page page.
 * @type {Object}
 */
demo.page = demo.page || {};

// Set a variable to show the external JS is loaded.
/** @type {boolean} */
demo.page.loaded = true;

demo.log('page: external javascript');
