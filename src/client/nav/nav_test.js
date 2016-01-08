// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for navigation-related core functions.
 */

goog.require('spf');
goog.require('spf.config');
goog.require('spf.history');
goog.require('spf.nav');
goog.require('spf.nav.request');
goog.require('spf.state');
goog.require('spf.url');


describe('spf.nav', function() {

  var MOCK_DELAY = 10;
  var objFunc = function() { return {}; };
  var nullFunc = function() { return null; };
  var trueFunc = function() { return true; };
  var falseFunc = function() { return false; };
  var createFakeBrowserEvent = function() {
    var target = {
      href: 'SPF_HREF'
    };
    var evt = {
      metaKey: false,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      target: target,
      defaultPrevented: false,
      preventDefault: function() { evt.defaultPrevented = true; }
    };
    return evt;
  };
  var createFakeRequest = function(response1, opt_response2, opt_shouldFail) {
    var counter = 0;
    var xhr = {
      abort: function() { },
      readyState: 1
    };
    var callOnSuccessDelayed = function(url, opts) {
      setTimeout(function() {
        if (counter == 0) {
          if (opt_response2) {
            opts.onPart(url, response1);
          } else {
            opts.onSuccess(url, response1);
          }
          counter++;
        } else {
          opts.onPart(url, opt_response2);
          var fullResponse = {
            'type': 'multipart',
            'parts': [response1, opt_response2]
          };
          opts.onSuccess(url, fullResponse);
        }
        xhr.readyState = 4;
      }, MOCK_DELAY);
    };
    var callOnErrorDelayed = function(url, opts) {
      setTimeout(function() {
        opts.onError(url, new Error());
        xhr.readyState = 4;
      }, MOCK_DELAY);
    };
    return function(url, options) {
      if (opt_shouldFail) {
        callOnErrorDelayed(url, options);
      } else {
        callOnSuccessDelayed(url, options);
      }
      return xhr;
    };
  };
  var fakeHistoryReplace = function(url, state, doCallback) {
    if (doCallback) {
      var callback = spf.state.get(spf.state.Key.HISTORY_CALLBACK);
      if (callback) {
        callback(url, state);
      }
    }
  };


  beforeEach(function() {
    spyOn(spf.history, 'add');
    spyOn(spf.history, 'replace').and.callFake(fakeHistoryReplace);
    if (!document.addEventListener) {
      document.addEventListener = jasmine.createSpy('addEventListener');
    }

    spf.nav.init();

    jasmine.clock().install();
  });


  afterEach(function() {
    jasmine.clock().uninstall();
    spf.nav.dispose();
    spf.config.clear();
    spf.state.values_ = {};
  });


  describe('prefetch', function() {


    it('prefetches a page', function() {
      var url = '/page';
      var fake = createFakeRequest({'foobar': true});
      spyOn(spf.nav.request, 'send').and.callFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      var prefetches = spf.nav.prefetches_();
      expect(prefetches[absoluteUrl]).toBeTruthy();

      jasmine.clock().tick(MOCK_DELAY + 1);
      expect(prefetches[absoluteUrl]).not.toBeTruthy();
    });


    it('promotes a prefetch', function() {
      spyOn(spf.nav, 'handleNavigateSuccess_');

      var url = '/page';
      var fake = createFakeRequest({'foobar': true});
      spyOn(spf.nav.request, 'send').and.callFake(fake);


      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      spf.nav.navigate(url);
      expect(spf.state.get(spf.state.Key.NAV_PROMOTE)).toEqual(url);

      jasmine.clock().tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateSuccess_).toHaveBeenCalled();
    });


    it('prefetch singlepart response with redirects', function() {
      spyOn(spf.nav, 'prefetch_').and.callThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2});
      spyOn(spf.nav.request, 'send').and.callFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);

      jasmine.clock().tick(MOCK_DELAY + 1);
      expect(spf.nav.prefetch_.calls.argsFor(1)[0]).toEqual(url2);
      expect(spf.nav.prefetch_.calls.count()).toEqual(2);
    });


    it('prefetch multipart response with redirects', function() {
      spyOn(spf.nav, 'prefetch_').and.callThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'foobar': true});
      spyOn(spf.nav.request, 'send').and.callFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);

      jasmine.clock().tick(2 * MOCK_DELAY + 1);
      expect(spf.nav.prefetch_.calls.argsFor(1)[0]).toEqual(url2);
      expect(spf.nav.prefetch_.calls.count()).toEqual(2);
    });


    it('promotes a prefetch with redirects', function() {
      spyOn(spf.nav, 'prefetch').and.callThrough();
      spyOn(spf.nav, 'handleNavigateSuccess_');

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'foobar': true});
      spyOn(spf.nav.request, 'send').and.callFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      jasmine.clock().tick(MOCK_DELAY + 1);
      spf.nav.navigate(url);

      jasmine.clock().tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateSuccess_).toHaveBeenCalled();
    });


    it('handles promoted prefetch errors', function() {
      spyOn(spf.nav, 'handleNavigateError_');

      var url = '/page';
      var fake = createFakeRequest({'foobar': true}, null, true);
      spyOn(spf.nav.request, 'send').and.callFake(fake);


      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      spf.nav.navigate(url);
      expect(spf.state.get(spf.state.Key.NAV_PROMOTE)).toEqual(url);

      jasmine.clock().tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateError_).toHaveBeenCalled();
    });
  });


  describe('handleClick', function() {


    beforeEach(function() {
      spyOn(spf.nav, 'navigate_');
    });


    it('ignores click with defaultPrevented', function() {
      var evt = createFakeBrowserEvent();

      evt.preventDefault();
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(true);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click with modifier keys', function() {
      var evt = createFakeBrowserEvent();

      evt.metaKey = true;
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click with alternative button', function() {
      var evt = createFakeBrowserEvent();

      evt.button = 1;
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click with nolink class', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithNoLinkClass_').and.callFake(objFunc);
      spf.config.set('nolink-class', 'NOLINK_CLASS');

      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without href', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').and.callFake(nullFunc);
      spyOn(spf.nav, 'getAncestorWithLinkClass_').and.callFake(objFunc);

      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithHref_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without link class', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithLinkClass_').and.callFake(nullFunc);

      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithLinkClass_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click if not eligible', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').and.callFake(function() {
          return {href: evt.target.href}; });
      spyOn(spf.nav, 'getAncestorWithLinkClass_').and.callFake(objFunc);
      spyOn(spf.nav, 'isEligible_').and.callFake(falseFunc);

      spf.nav.handleClick_(evt);

      expect(spf.nav.isEligible_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('handles spf click', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').and.callFake(function() {
          return {href: evt.target.href}; });
      spyOn(spf.nav, 'getAncestorWithLinkClass_').and.callFake(objFunc);

      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(true);
      expect(spf.nav.navigate_).toHaveBeenCalled();
      expect(spf.nav.navigate_.calls.argsFor(0)[0]).toEqual(evt.target.href);
    });


  });


  describe('isAllowed', function() {


    it('respects same-origin security', function() {
      var sameDomainUrl = '/page';
      var crossDomainUrl = 'https://www.google.com/';
      expect(spf.nav.isAllowed_(sameDomainUrl)).toBe(true);
      expect(spf.nav.isAllowed_(crossDomainUrl)).toBe(false);
    });


  });


  describe('isEligible', function() {


    it('respects initialization', function() {
      var url = '/page';
      spf.state.set(spf.state.Key.NAV_INIT, false);
      expect(spf.nav.isEligible_(url)).toBe(false);
      spf.state.set(spf.state.Key.NAV_INIT, true);
      expect(spf.nav.isEligible_(url)).toBe(true);
    });


    it('respects session navigation limit', function() {
      var url = '/page';
      spf.config.set('navigate-limit', 5);
      spf.state.set(spf.state.Key.NAV_COUNTER, 5);
      expect(spf.nav.isEligible_(url)).toBe(false);
      spf.state.set(spf.state.Key.NAV_COUNTER, 4);
      expect(spf.nav.isEligible_(url)).toBe(true);
      spf.config.set('navigate-limit', null);
      spf.state.set(spf.state.Key.NAV_COUNTER, 999999);
      expect(spf.nav.isEligible_(url)).toBe(true);
    });


    it('respects session lifetime', function() {
      var url = '/page';
      // Lifetime at 1s, age at 1s should be expired.
      spf.config.set('navigate-lifetime', 1000);
      spf.state.set(spf.state.Key.NAV_INIT_TIME, spf.now() - 1000);
      expect(spf.nav.isEligible_(url)).toBe(false);
      // Lifetime at 1s, age at 0.5s should be unexpired.
      spf.state.set(spf.state.Key.NAV_INIT_TIME, spf.now() - 500);
      expect(spf.nav.isEligible_(url)).toBe(true);
      // Lifetime at unlimited, age at 10d should be unexpired.
      spf.config.set('navigate-lifetime', null);
      // 864000000ms = 10d * 24hr/d * 60min/hr * 60s/min * 1000ms/s.
      spf.state.set(spf.state.Key.NAV_INIT_TIME, spf.now() - 864000000);
      expect(spf.nav.isEligible_(url)).toBe(true);
    });


  });


  describe('isNavigable', function() {


    it('allows standard to standard across pages', function() {
      var current = window.location.href;
      var url = '/page';
      var crossDomainUrl = 'https://www.google.com/page';
      expect(spf.nav.isNavigable_(url, current)).toBe(true);
      expect(spf.nav.isNavigable_(crossDomainUrl, current)).toBe(true);
    });


    it('allows standard to hash across pages', function() {
      var current = window.location.href;
      var urlWithTargetHash = '/page#target';
      var urlWithEmptyHash = '/page#';
      var crossDomainUrlWithTargetHash = 'https://www.google.com/page#target';
      var crossDomainUrlWithEmptyHash = 'https://www.google.com/page#';
      expect(spf.nav.isNavigable_(urlWithTargetHash, current)).toBe(true);
      expect(spf.nav.isNavigable_(urlWithEmptyHash, current)).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrlWithTargetHash, current)).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrlWithEmptyHash, current)).toBe(true);
    });


    it('allows hash to standard across pages', function() {
      var current = window.location.href;
      var currentWithTargetHash = spf.url.absolute(current) + '#target';
      var currentWithEmptyHash = spf.url.absolute(current) + '#';
      var url = '/page';
      var crossDomainUrl = 'https://www.google.com/page';
      expect(spf.nav.isNavigable_(url, currentWithTargetHash)).toBe(true);
      expect(spf.nav.isNavigable_(url, currentWithEmptyHash)).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrl, currentWithTargetHash)).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrl, currentWithEmptyHash)).toBe(true);
    });


    it('allows hash to hash across pages', function() {
      var current = window.location.href;
      var currentWithTargetHash = spf.url.absolute(current) + '#target';
      var currentWithEmptyHash = spf.url.absolute(current) + '#';
      var urlWithTargetHash = '/page#target';
      var urlWithEmptyHash = '/page#';
      var crossDomainUrlWithTargetHash = 'https://www.google.com/page#target';
      var crossDomainUrlWithEmptyHash = 'https://www.google.com/page#';
      expect(spf.nav.isNavigable_(
                 urlWithTargetHash, currentWithTargetHash)).toBe(true);
      expect(spf.nav.isNavigable_(
                 urlWithTargetHash, currentWithEmptyHash)).toBe(true);
      expect(spf.nav.isNavigable_(
                 urlWithEmptyHash, currentWithTargetHash)).toBe(true);
      expect(spf.nav.isNavigable_(
                 urlWithEmptyHash, currentWithEmptyHash)).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrlWithTargetHash, currentWithTargetHash)
             ).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrlWithTargetHash, currentWithEmptyHash)
             ).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrlWithEmptyHash, currentWithTargetHash)
             ).toBe(true);
      expect(spf.nav.isNavigable_(
                 crossDomainUrlWithEmptyHash, currentWithEmptyHash)
             ).toBe(true);
    });


    it('allows standard to standard for same page', function() {
      var current = window.location.href;
      var url = current;
      expect(spf.nav.isNavigable_(url, current)).toBe(true);
    });


    it('denies standard to hash for same page', function() {
      var current = window.location.href;
      var urlWithTargetHash = spf.url.absolute(current) + '#target';
      var urlWithEmptyHash = spf.url.absolute(current) + '#';
      expect(spf.nav.isNavigable_(urlWithTargetHash, current)).toBe(false);
      expect(spf.nav.isNavigable_(urlWithEmptyHash, current)).toBe(false);
    });


    it('allows hash to standard for same page', function() {
      var current = window.location.href;
      var currentWithTargetHash = spf.url.absolute(current) + '#target';
      var currentWithEmptyHash = spf.url.absolute(current) + '#';
      var url = current;
      expect(spf.nav.isNavigable_(url, currentWithTargetHash)).toBe(true);
      expect(spf.nav.isNavigable_(url, currentWithEmptyHash)).toBe(true);
    });


    it('denies hash to hash for same page', function() {
      var current = window.location.href;
      var currentWithTargetHash = spf.url.absolute(current) + '#target';
      var currentWithEmptyHash = spf.url.absolute(current) + '#';
      var urlWithTargetHash = currentWithTargetHash;
      var urlWithEmptyHash = currentWithEmptyHash;
      expect(spf.nav.isNavigable_(
                 urlWithTargetHash, currentWithTargetHash)).toBe(false);
      expect(spf.nav.isNavigable_(
                 urlWithTargetHash, currentWithEmptyHash)).toBe(false);
      expect(spf.nav.isNavigable_(
                 urlWithEmptyHash, currentWithTargetHash)).toBe(false);
      expect(spf.nav.isNavigable_(
                 urlWithEmptyHash, currentWithEmptyHash)).toBe(false);
    });


  });


  describe('navigate', function() {


    it('handles singlepart redirect response', function() {
      // Skip history tests for browsers which don't support the history apis.
      // TODO(dcphillips): Figure out a way to control this in the BUILD files.
      if (!window.history.pushState || !window.history.replaceState) {
        return;
      }

      spyOn(spf.nav, 'navigate_').and.callThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2});
      spyOn(spf.nav.request, 'send').and.callFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.navigate(url);

      jasmine.clock().tick(MOCK_DELAY + 1);
      expect(spf.nav.navigate_.calls.argsFor(1)[0]).toEqual(url2);
      expect(spf.nav.navigate_.calls.count()).toEqual(2);
    });


    it('handles multipart redirect response', function() {
      // Skip history tests for browsers which don't support the history apis.
      // TODO(dcphillips): Figure out a way to control this in the BUILD files.
      if (!window.history.pushState || !window.history.replaceState) {
        return;
      }

      spyOn(spf.nav, 'navigate_').and.callThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'foobar': true});
      spyOn(spf.nav.request, 'send').and.callFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.navigate(url);

      jasmine.clock().tick(2 * MOCK_DELAY + 1);
      expect(spf.nav.navigate_.calls.argsFor(1)[0]).toEqual(url2);
      expect(spf.nav.navigate_.calls.count()).toEqual(2);
    });


  });


  describe('dispatchError', function() {

    var url = '/page';
    var err = new Error();


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchError_(url, err);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.ERROR);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchError_(url, err);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('executes a callback', function() {
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('executes a callback and propagates cancellation', function() {
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      var evtData = spf.dispatch.calls.argsFor(0)[1];
      var fnData = fn.calls.argsFor(0)[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchReload', function() {

    var url = '/page';

    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      spf.nav.dispatchReload_(url);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.RELOAD);
    });


  });


  describe('dispatchClick', function() {

    var url = '/page';
    var target = document.createElement('a');


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchClick_(url, target);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.CLICK);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchClick_(url, target);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


  });


  describe('dispatchHistory', function() {

    var url = '/page';


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchHistory_(url);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.HISTORY);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchHistory_(url);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


  });


  describe('dispatchRequest', function() {

    var url = '/page';
    var referer = '/other';
    var previous = '/previous';


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchRequest_(url, referer, previous);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.REQUEST);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchRequest_(url, referer, previous);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('executes a callback', function() {
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('executes a callback and propagates cancellation', function() {
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      var evtData = spf.dispatch.calls.argsFor(0)[1];
      var fnData = fn.calls.argsFor(0)[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchPartProcess', function() {

    var url = '/page';
    var partial = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchPartProcess_(url, partial);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.PART_PROCESS);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchPartProcess_(url, partial);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('executes a callback', function() {
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('executes a callback and propagates cancellation', function() {
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      var evtData = spf.dispatch.calls.argsFor(0)[1];
      var fnData = fn.calls.argsFor(0)[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchPartDone', function() {

    var url = '/page';
    var partial = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchPartDone_(url, partial);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.PART_DONE);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchPartDone_(url, partial);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('executes a callback', function() {
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('executes a callback and propagates cancellation', function() {
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      var evtData = spf.dispatch.calls.argsFor(0)[1];
      var fnData = fn.calls.argsFor(0)[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchProcess', function() {

    var url = '/page';
    var response = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchProcess_(url, response);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.PROCESS);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchProcess_(url, response);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('executes a callback', function() {
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('executes a callback and propagates cancellation', function() {
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      var evtData = spf.dispatch.calls.argsFor(0)[1];
      var fnData = fn.calls.argsFor(0)[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchDone', function() {

    var url = '/page';
    var response = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var proceed = spf.nav.dispatchDone_(url, response);
      var evtName = spf.dispatch.calls.argsFor(0)[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual(spf.EventName.DONE);
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').and.returnValue(false);
      var proceed = spf.nav.dispatchDone_(url, response);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('executes a callback', function() {
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('executes a callback and propagates cancellation', function() {
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn').and.returnValue(false);
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').and.callThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      var evtData = spf.dispatch.calls.argsFor(0)[1];
      var fnData = fn.calls.argsFor(0)[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


});
