// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

(function () {
  'use strict';

  var html = document.getElementsByTagName('html')[0];
  var body = document.body;
  var nav = document.getElementById('nav');
  var appbar = document.getElementById('app-bar');
  var menu = document.getElementById('menu');
  var content = document.getElementById('content');
  var progress = document.getElementById('progress');

  var previous = -1;
  var timer = -1;

  var animation = {
    // Most progress waiting for response.
    REQUEST: [100, 95, 'waiting'],
    // Finish during short processing time.
    PROCESS: [10, 101, 'waiting'],
    // Fade it out slowly.
    DONE: [100, 101, 'done']
  };

  html.className = html.className.replace('no-js', '');
  if (!('ontouchstart' in window)) {
    html.className = html.className + ' no-touch';
  }

  function closeMenu() {
    body.classList.remove('open');
    appbar.classList.remove('open');
    nav.classList.remove('open');
  }

  function toggleMenu() {
    body.classList.toggle('open');
    appbar.classList.toggle('open');
    nav.classList.toggle('open');
  }

  function setProgress(anim) {
    clearTimeout(timer);
    progress.className = '';
    var ps = progress.style;
    ps.transitionDuration = ps.webkitTransitionDuration = anim[0] + 'ms';
    ps.width = anim[1] + '%';
    if (anim[2] == 'done') {
      progress.className = anim[2];
      timer = setTimeout(function() {
        ps.width = '0%';  // Reset bar to beginning after done.
      }, anim[0]);
    } else {
      timer = setTimeout(function() {
        progress.className = anim[2];
      }, anim[0]);
    }
  }

  function clearProgress() {
    clearTimeout(timer);
    progress.className = '';
    var ps = progress.style;
    ps.transitionDuration = ps.webkitTransitionDuration = '0ms';
    ps.width = '0%';
  }

  function handleNavClick(event) {
    if (event.target.nodeName === 'A' || event.target.nodeName === 'LI') {
      closeMenu();
    }
  }

  function handleScroll(event) {
    var current = body.scrollTop;
    if (current >= 80 && previous < 80) {
      body.className = body.className + ' scrolled';
    } else if (current < 80 && previous >= 80) {
      body.className = body.className.replace(' scrolled', '');
    }
    previous = current;
  }

  function handleRequest(event) {
    setProgress(animation.REQUEST);
  }

  function handleProcess(event) {
    setProgress(animation.PROCESS);
  }

  function handleDone(event) {
    setProgress(animation.DONE);
    window.scroll(0,0);
    handleScroll();
  }

  function handleScriptBeforeUnload(event) {
    // If this script is going to be replaced with a new version,
    // dispose before the new one is loaded.
    if (event.detail.name == 'main') {
      dispose();
    }
  }

  function init() {
    content.addEventListener('click', closeMenu);
    menu.addEventListener('click', toggleMenu);
    nav.addEventListener('click', handleNavClick);
    window.addEventListener('scroll', handleScroll);

    spf.init({
      'cache-unified': true,
      'url-identifier': '.spf.json'
    });
    document.addEventListener('spfrequest', handleRequest);
    document.addEventListener('spfprocess', handleProcess);
    document.addEventListener('spfdone', handleDone);
    document.addEventListener('spfjsbeforeunload', handleScriptBeforeUnload);
  }

  function dispose() {
    content.removeEventListener('click', closeMenu);
    menu.removeEventListener('click', toggleMenu);
    nav.removeEventListener('click', handleNavClick);
    window.removeEventListener('scroll', handleScroll);

    spf.dispose();
    document.removeEventListener('spfprocess', handleRequest);
    document.removeEventListener('spfrequest', handleProcess);
    document.removeEventListener('spfdone', handleDone);
    document.removeEventListener('spfjsbeforeunload', handleScriptBeforeUnload);

    clearProgress();
  }

  init();
})();
