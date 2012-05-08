// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview JavaScript for the SPF demo app.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


/**
 * The demo app namespace.
 * @type {Object}
 */
var demo = demo || {};


/**
 * Initialize the demo app.
 */
demo.init = function() {
  demo.start_ = +(new Date());
  demo.timer_ = window.setInterval(demo.updateTime, 500);
};


/**
 * Dispose the demo app.
 */
demo.dispose = function() {
  window.clearInterval(demo.timer_);
  demo.start_ = 0;
};


/**
 * Update the display counting time since last page load.
 */
demo.updateTime = function() {
  var timerEl = document.getElementById('demo-timer');
  if (timerEl) {
    if (demo.start_) {
      var time = Math.floor((+(new Date()) - demo.start_) / 1000);
      timerEl.innerHTML = time;
    } else {
      timerEl.innerHTML = ''
    }
  }
};


/**
 * Callback for clicks.
 * @param {Element} el The clicked element.
 */
demo.handleClick = function(el) {
  window.console.log('demo: clicked', el);
};


/**
 * Callback for navigations.
 * @param {string} url The URL that was navigated to.
 */
demo.handleNavigate = function(url) {
  window.console.log('demo: navigated', url);
};


/**
 * Callback for requests.
 * @param {string} url The reqested URL, without the SPF identifier.
 * @param {Object} response The requested SPF response object.
 */
demo.handleRequest = function(url, response) {
  window.console.log('demo: requested', url, response);
};


/**
 * Callback for loads.
 * @param {string} url The loaded URL, without the SPF identifier.
 * @param {Object} response The loaded SPF response object.
 */
demo.handleLoad = function(url, response) {
  window.console.log('demo: loaded', url, response);
};


/**
 * The timestamp of when the demo app started.
 * @type {number}
 * @private
 */
demo.start_ = 0;


/**
 * The timer counting since last page load.
 * @type {number}
 * @private
 */
demo.timer_ = 0;
