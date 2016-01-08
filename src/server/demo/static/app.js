// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

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
    window.addEventListener('spfclick', app.onClick);
    window.addEventListener('spfhistory', app.onHistory);
    window.addEventListener('spfrequest', app.onRequest);
    window.addEventListener('spfpartprocess', app.onPartProcess);
    window.addEventListener('spfpartdone', app.onPartDone);
    window.addEventListener('spfprocess', app.onProcess);
    window.addEventListener('spfdone', app.onDone);
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
    window.removeEventListener('spfclick', app.onClick);
    window.removeEventListener('spfhistory', app.onHistory);
    window.removeEventListener('spfrequest', app.onRequest);
    window.removeEventListener('spfpartprocess', app.onPartProcess);
    window.removeEventListener('spfpartdone', app.onPartDone);
    window.removeEventListener('spfprocess', app.onProcess);
    window.removeEventListener('spfdone', app.onDone);
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
 * Event handler for when a navigate click occurs.
 * @param {CustomEvent} evt The event.
 */
app.onClick = function(evt) {
  app.log('navigate click ' + evt.detail.url);
};


/**
 * Event handler for when a navigate history change occurs.
 * @param {CustomEvent} evt The event.
 */
app.onHistory = function(evt) {
  app.log('navigate history ' + evt.detail.url);
};


/**
 * Event handler for when navigate requests are going to be sent.
 * @param {CustomEvent} evt The event.
 */
app.onRequest = function(evt) {
  app.log('navigate request ' + evt.detail.url);
  // If debug logging is enabled, reset the relative times when each new
  // request is sent.
  if (spf.debug) {
    spf.debug.reset();
  }
};


/**
 * Event handler for when parts of navigate responses are going to be processed.
 * @param {CustomEvent} evt The event.
 */
app.onPartProcess = function(evt) {
  app.log('navigate part process ' + evt.detail.url);
};


/**
 * Event handler for when parts of navigate responses are done being processed.
 * @param {CustomEvent} evt The event.
 */
app.onPartDone = function(evt) {
  app.log('navigate part done ' + evt.detail.url);
};


/**
 * Event handler for when navigate responses are going to be processed.
 * @param {CustomEvent} evt The event.
 */
app.onProcess = function(evt) {
  app.log('navigate process ' + evt.detail.url);
};


/**
 * Event handler for when navigate responses are done being processed.
 * @param {CustomEvent} evt The event.
 */
app.onDone = function(evt) {
  app.log('navigate done ' + evt.detail.url);
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
