/**
 * @fileoverview Sample JavaScript for "Demo Pages" area of the SPF demo app.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// This file only exists to demonstrate external JS being loaded.

var app = app || {};

/**
 * Simple central logging function for the demo app.
 * @param {string} msg Message to log.
 */
app.log = function(msg) {
  if (window.console) {
    window.console.log('[app] ' + msg);
  }
};

/**
 * The namespace for the demo page.
 * @type {Object}
 */
app.demo = app.demo || {};

// Set a variable to show the external JS is loaded.
/** @type {boolean} */
app.demo.loaded = true;

app.log('demo: external javascript');
