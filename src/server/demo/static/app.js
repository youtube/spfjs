/**
 * @fileoverview JavaScript for the SPF demo app.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


/**
 * The demo app namespace.
 * @type {Object}
 */
var app = app || {};


/**
 * Initialize the demo app.
 */
app.init = function() {
  app.start_ = +new Date();
  app.timer_ = window.setInterval(app.updateTime, 500);
  if (window.addEventListener) {
    window.addEventListener('spfrequested', app.onRequested);
    window.addEventListener('spfpartreceived', app.onPartReceived);
    window.addEventListener('spfpartprocessed', app.onPartProcessed);
    window.addEventListener('spfreceived', app.onReceived);
    window.addEventListener('spfprocessed', app.onProcessed);
    window.addEventListener('spferror', app.onError);
    window.addEventListener('spfjsbeforeunload', app.onScriptBeforeUnload);
    window.addEventListener('spfjsunload', app.onScriptUnload);
    window.addEventListener('spfcssbeforeunload', app.onStyleBeforeUnload);
    window.addEventListener('spfcssunload', app.onStyleUnload);
  }
  app.enabled = spf.init();
  app.updateStatus();
};


/**
 * Dispose the demo app.
 */
app.dispose = function() {
  window.clearInterval(app.timer_);
  app.start_ = 0;
  app.enabled = false;
  app.updateStatus();
  app.updateTime();
  if (window.removeEventListener) {
    window.removeEventListener('spfrequested', app.onRequested);
    window.removeEventListener('spfpartreceived', app.onPartReceived);
    window.removeEventListener('spfpartprocessed', app.onPartProcessed);
    window.removeEventListener('spfreceived', app.onReceived);
    window.removeEventListener('spfprocessed', app.onProcessed);
    window.removeEventListener('spferror', app.onError);
    window.removeEventListener('spfjsbeforeunload', app.onScriptBeforeUnload);
    window.removeEventListener('spfjsunload', app.onScriptUnload);
    window.removeEventListener('spfcssbeforeunload', app.onStyleBeforeUnload);
    window.removeEventListener('spfcssunload', app.onStyleUnload);
  }
};


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
 * Update the display showing whether SPF is enabled.
 */
app.updateStatus = function() {
  var statusEl = document.getElementById('app-status');
  if (statusEl) {
    if (app.enabled) {
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
app.updateTime = function() {
  var timerEl = document.getElementById('app-timer');
  if (timerEl) {
    if (app.start_) {
      var time = Math.floor((+new Date() - app.start_) / 1000);
      timerEl.innerHTML = time;
    } else {
      timerEl.innerHTML = '';
    }
  }
};


/**
 * Event handler for when navigate requests are sent.
 * @param {CustomEvent} evt The event.
 */
app.onRequested = function(evt) {
  app.log('navigate requested ' + evt.detail.url);
};


/**
 * Event handler for when parts of navigate requests are received.
 * @param {CustomEvent} evt The event.
 */
app.onPartReceived = function(evt) {
  app.log('navigate received part ' + evt.detail.url);
};


/**
 * Event handler for when parts of navigate requests are processed.
 * @param {CustomEvent} evt The event.
 */
app.onPartProcessed = function(evt) {
  app.log('navigate processed part ' + evt.detail.url);
};


/**
 * Event handler for when navigate responses are received.
 * @param {CustomEvent} evt The event.
 */
app.onReceived = function(evt) {
  app.log('navigate received ' + evt.detail.url);
  // If debug logging is enabled, reset the relative times when each new
  // request is received.
  if (spf.debug) {
    spf.debug.reset();
  }
};


/**
 * Event handler for when navigate responses are processed.
 * @param {CustomEvent} evt The event.
 */
app.onProcessed = function(evt) {
  app.log('navigate processed ' + evt.detail.url);
};


/**
 * Event handler for navigate errors.
 * @param {CustomEvent} evt The event.
 */
app.onError = function(evt) {
  app.log('navigate error ' + evt.detail.url);
};


/**
 * Event handler for script before unload.
 * @param {CustomEvent} evt The event.
 */
app.onScriptBeforeUnload = function(evt) {
  var name = evt.detail.name;
  app.log('script before unload ' + name);
};


/**
 * Event handler for script unload.
 * @param {CustomEvent} evt The event.
 */
app.onScriptUnload = function(evt) {
  var name = evt.detail.name;
  var urls = evt.detail.urls;
  app.log('script unload ' + name + ' ' + urls);
};



/**
 * Event handler for style before unload.
 * @param {CustomEvent} evt The event.
 */
app.onStyleBeforeUnload = function(evt) {
  var name = evt.detail.name;
  app.log('style before unload ' + name);
};


/**
 * Event handler for style unload.
 * @param {CustomEvent} evt The event.
 */
app.onStyleUnload = function(evt) {
  var name = evt.detail.name;
  var urls = evt.detail.urls;
  app.log('style unload ' + name + ' ' + urls);
};


/**
 * Whether SPF is enabled for the demo app.
 * @type {boolean}
  */
app.enabled = false;


/**
 * The timestamp of when the demo app started.
 * @type {number}
 * @private
 */
app.start_ = 0;


/**
 * The timer counting since last page load.
 * @type {number}
 * @private
 */
app.timer_ = 0;


////////////////////////////////////////////////////////////////////////////////


/**
 * The demo app namespace for the home page.
 * @type {Object}
 */
app.home = app.home || {};


/**
 * Initialize the demo app home page.
 */
app.home.init = function() {
  // Show the correct support notice.
  var id = app.enabled ? 'home-full' : 'home-partial';
  document.getElementById(id).style.display = '';
  // Enable the extra content button.
  var buttonEl = document.getElementById('home-ajax-get');
  buttonEl.onclick = function() {
    spf.load('/index_ajax', {'method': 'POST'});
  };
};
