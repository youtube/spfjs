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

  var position = -1;
  var start = -1;
  var timer = -1;

  // Animation states: start time, duration, progress complete, and css class.
  var animation = {
    // Most progress waiting for response; duration is 3x expected to
    // accommodate slow networks and will be short-circuited by next step.
    REQUEST: [0, 300, '95%', 'waiting'],
    // Finish during short processing time.
    PROCESS: [100, 25, '101%', 'waiting'],
    // Fade it out slowly.
    DONE: [125, 150, '101%', 'done']
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
    var elapsed = (new Date()).getTime() - start;
    var scheduled = anim[0];
    var duration = anim[1];
    var percentage = anim[2];
    var classes = anim[3];
    var wait = scheduled - elapsed;
    // Since navigation can often be faster than the animation,
    // wait for the last scheduled step of the progress bar to complete
    // before finishing.
    if (classes == 'done' && wait > 0) {
      timer = setTimeout(function() {
        setProgress(anim);
      }, wait);
      return;
    }
    progress.className = '';
    var ps = progress.style;
    ps.transitionDuration = ps.webkitTransitionDuration = duration + 'ms';
    ps.width = percentage;
    if (classes == 'done') {
      // If done, set the class now to start the fade-out and wait until
      // the duration is over (i.e. the fade is complete) to reset the bar
      // to the beginning.
      progress.className = classes;
      timer = setTimeout(function() {
        ps.width = '0%';
      }, duration);
    } else {
      // If waiting, set the class after the duration is over (i.e. the
      // bar has finished moving) to set the class and start the pulse.
      timer = setTimeout(function() {
        progress.className = classes;
      }, duration);
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
    if (current >= 80 && position < 80) {
      body.className = body.className + ' scrolled';
    } else if (current < 80 && position >= 80) {
      body.className = body.className.replace(' scrolled', '');
    }
    position = current;
  }

  function handleRequest(event) {
    start = (new Date()).getTime();
    setProgress(animation.REQUEST);
  }

  function handleProcess(event) {
    setProgress(animation.PROCESS);
    window.scroll(0,0);
  }

  function handleDone(event) {
    setProgress(animation.DONE);
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
