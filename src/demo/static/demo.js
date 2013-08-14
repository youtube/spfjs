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
  demo.start_ = +new Date();
  demo.timer_ = window.setInterval(demo.updateTime, 500);
  var config = {
    'navigate-requested-callback': demo.handleNavigateRequested,
    'navigate-begin-response-callback': demo.handleNavigateBeginResponse,
    'navigate-received-callback': demo.handleNavigateReceived,
    'navigate-processed-callback': demo.handleNavigateProcessed,
    'navigate-error-callback': demo.handleNavigateError,
    'script-loading-callback': demo.handleScriptLoading,
    'style-loading-callback': demo.handleStyleLoading
  };
  demo.enabled = spf.init(config);
  demo.updateStatus();
};


/**
 * Dispose the demo app.
 */
demo.dispose = function() {
  window.clearInterval(demo.timer_);
  demo.start_ = 0;
  demo.enabled = false;
  demo.updateStatus();
  demo.updateTime();
};


/**
 * Simple central logging function for the demo app.
 */
demo.log = function(msg) {
  if (window.console) {
    window.console.log('[demo] ' + msg);
  }
};


/**
 * Update the display showing whether SPF is enabled.
 */
demo.updateStatus = function() {
  var statusEl = document.getElementById('demo-status');
  if (statusEl) {
    if (demo.enabled) {
      statusEl.innerHTML = 'Enabled';
      statusEl.className = 'enabled';
    } else {
      statusEl.innerHTML = 'Disabled';
      statusEl.className = 'disabled';
    }
  }
};


/**
 * Update the display counting time since last page load.
 */
demo.updateTime = function() {
  var timerEl = document.getElementById('demo-timer');
  if (timerEl) {
    if (demo.start_) {
      var time = Math.floor((+new Date() - demo.start_) / 1000);
      timerEl.innerHTML = time;
    } else {
      timerEl.innerHTML = ''
    }
  }
};


/**
 * Callback for when navigate requests are sent.
 * @param {string} url The new URL.
 */
demo.handleNavigateRequested = function(url) {
  demo.log('navigate requested');
};


/**
 * Callback for when navigate requests begin receiving a response.
 * @param {string} url The new URL.
 */
demo.handleNavigateBeginResponse = function(url) {
  demo.log('navigate begin response');
};


/**
 * Callback for when navigate requests are received.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {Object} response The requested SPF response object.
 */
demo.handleNavigateReceived = function(url, response) {
  demo.log('navigate received');
  // If debug logging is enabled, reset the relative times when each new
  // request is received.
  if (spf.debug) {
    spf.debug.reset();
  }
};


/**
 * Callback for navigate response processing.
 * @param {Object} response The processed SPF response object.
 */
demo.handleNavigateProcessed = function(response) {
  demo.log('navigate processed');
};


/**
 * Callback for navigate errors.
 * @param {string} url The requested URL, without the SPF identifier.
 * @param {Error} err The Error object.
 */
demo.handleNavigateError = function(url, err) {
  demo.log('navigate error');
};


/**
 * Callback for script loading.
 * @param {string} url The new script URL.
 * @param {string} name The new script name (to identify it independently of
 *     the URL).
 */
demo.handleScriptLoading = function(url, name) {
  demo.log('script loading ' + url + ' ' + name);
};

/**
 * Callback for style loading.
 * @param {string} url The new style URL.
 * @param {string} name The new style name (to identify it independently of
 *     the URL).
 */
demo.handleStyleLoading = function(url, name) {
  demo.log('style loading ' + url + ' ' + name);
};


/**
 * Whether SPF is enabled for the demo app.
 * @type {boolean}
  */
demo.enabled = false;


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


////////////////////////////////////////////////////////////////////////////////


/**
 * The demo app namespace for the home page.
 * @type {Object}
 */
demo.home = demo.home || {};


/**
 * Initialize the demo app home page.
 */
demo.home.init = function() {
  // Show the correct support notice.
  var id = demo.enabled ? 'home-full' : 'home-partial';
  document.getElementById(id).style.display = '';
  // Enable the extra content button.
  var buttonEl = document.getElementById('home-ajax-get');
  buttonEl.onclick = demo.home.onGetExtra;
};


/**
 * Event handler for the extra content button.
 */
demo.home.onGetExtra = function() {
  spf.load('/index_ajax');
};
