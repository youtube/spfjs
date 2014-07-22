// Copyright 2014 Google Inc. All rights reserved.
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
      var callback = spf.state.get('history-callback');
      if (callback) {
        callback(url, state);
      }
    }
  };


  beforeEach(function() {
    spyOn(spf.history, 'add');
    spyOn(spf.history, 'replace').andCallFake(fakeHistoryReplace);
    if (!document.addEventListener) {
      document.addEventListener = jasmine.createSpy('addEventListener');
    }

    spf.nav.init();
    jasmine.Clock.useMock();
  });


  afterEach(function() {
    spf.nav.dispose();
    spf.config.clear();
    spf.state.values_ = {};
  });


  describe('prefetch', function() {


    it('prefetches a page', function() {
      var url = '/page';
      var fake = createFakeRequest({'foobar': true});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      var prefetches = spf.nav.prefetches_();
      expect(prefetches[absoluteUrl]).toBeTruthy();

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(prefetches[absoluteUrl]).not.toBeTruthy();
    });


    it('promotes a prefetch', function() {
      spyOn(spf.nav, 'handleNavigateSuccess_');

      var url = '/page';
      var fake = createFakeRequest({'foobar': true});
      spyOn(spf.nav.request, 'send').andCallFake(fake);


      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      spf.nav.navigate(url);
      expect(spf.state.get('nav-promote')).toEqual(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateSuccess_).toHaveBeenCalled();
    });


    it('prefetch singlepart response with redirects', function() {
      spyOn(spf.nav, 'prefetch_').andCallThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.prefetch_.calls[1].args[0]).toEqual(url2);
      expect(spf.nav.prefetch_.calls.length).toEqual(2);
    });


    it('prefetch multipart response with redirects', function() {
      spyOn(spf.nav, 'prefetch_').andCallThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'foobar': true});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);

      jasmine.Clock.tick(2 * MOCK_DELAY + 1);
      expect(spf.nav.prefetch_.calls[1].args[0]).toEqual(url2);
      expect(spf.nav.prefetch_.calls.length).toEqual(2);
    });


    it('promotes a prefetch with redirects', function() {
      spyOn(spf.nav, 'prefetch').andCallThrough();
      spyOn(spf.nav, 'handleNavigateSuccess_');

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'foobar': true});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      jasmine.Clock.tick(MOCK_DELAY + 1);
      spf.nav.navigate(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateSuccess_).toHaveBeenCalled();
    });


    it('handles promoted prefetch errors', function() {
      spyOn(spf.nav, 'handleNavigateError_');

      var url = '/page';
      var fake = createFakeRequest({'foobar': true}, null, true);
      spyOn(spf.nav.request, 'send').andCallFake(fake);


      var absoluteUrl = spf.url.absolute(url);
      spf.nav.prefetch(url);
      spf.nav.navigate(url);
      expect(spf.state.get('nav-promote')).toEqual(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.handleNavigateError_).toHaveBeenCalled();
    });
  });


  describe('handleClick', function() {


    beforeEach(function(argument) {
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
      spyOn(spf.nav, 'getAncestorWithNoLinkClass_').andCallFake(objFunc);
      spf.config.set('nolink-class', 'NOLINK_CLASS');

      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without href', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').andCallFake(nullFunc);
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(objFunc);

      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithHref_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without link class', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(nullFunc);

      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithLinkClass_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click if not eligible', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').andCallFake(function() {
          return {href: evt.target.href}; });
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(objFunc);
      spyOn(spf.nav, 'isNavigateEligible_').andCallFake(falseFunc);

      spf.nav.handleClick_(evt);

      expect(spf.nav.isNavigateEligible_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('handles spf click', function() {
      var evt = createFakeBrowserEvent();
      spyOn(spf.nav, 'getAncestorWithHref_').andCallFake(function() {
          return {href: evt.target.href}; });
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(objFunc);

      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(true);
      expect(spf.nav.navigate_).toHaveBeenCalledWith(evt.target.href);
    });


  });


  describe('isNavigateEligible', function() {


    it('respects initialization', function() {
      var url = '/page';
      spf.state.set('nav-init', false);
      expect(spf.nav.isNavigateEligible_(url)).toBe(false);
      spf.state.set('nav-init', true);
      expect(spf.nav.isNavigateEligible_(url)).toBe(true);
    });


    it('respects session navigation limit', function() {
      var url = '/page';
      spf.config.set('navigate-limit', 5);
      spf.state.set('nav-counter', 5);
      expect(spf.nav.isNavigateEligible_(url)).toBe(false);
      spf.state.set('nav-counter', 4);
      expect(spf.nav.isNavigateEligible_(url)).toBe(true);
      spf.config.set('navigate-limit', null);
      spf.state.set('nav-counter', 999999);
      expect(spf.nav.isNavigateEligible_(url)).toBe(true);
    });


    it('respects session lifetime', function() {
      var url = '/page';
      spf.config.set('navigate-lifetime', 1000);
      spf.state.set('nav-time', spf.now() - 1000);
      expect(spf.nav.isNavigateEligible_(url)).toBe(false);
      spf.state.set('nav-time', spf.now() - 500);
      expect(spf.nav.isNavigateEligible_(url)).toBe(true);
      spf.config.set('navigate-lifetime', null);
      spf.state.set('nav-time', spf.now() - (10 * 24 * 60 * 60 * 1000));
      expect(spf.nav.isNavigateEligible_(url)).toBe(true);
    });


  });


  describe('navigate', function() {


    it('handles singlepart redirect response', function() {
      // Skip history tests for browsers which don't support the history apis.
      // TODO(dcphillips): Figure out a way to control this in the BUILD files.
      if (!window.history.pushState || !window.history.replaceState) {
        return;
      }

      spyOn(spf.nav, 'navigate_').andCallThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.navigate(url);

      jasmine.Clock.tick(MOCK_DELAY + 1);
      expect(spf.nav.navigate_.calls[1].args[0]).toEqual(url2);
      expect(spf.nav.navigate_.calls.length).toEqual(2);
    });


    it('handles multipart redirect response', function() {
      // Skip history tests for browsers which don't support the history apis.
      // TODO(dcphillips): Figure out a way to control this in the BUILD files.
      if (!window.history.pushState || !window.history.replaceState) {
        return;
      }

      spyOn(spf.nav, 'navigate_').andCallThrough();

      var url = '/page';
      var url2 = '/page2';
      var fake = createFakeRequest({'redirect': url2}, {'foobar': true});
      spyOn(spf.nav.request, 'send').andCallFake(fake);

      var absoluteUrl = spf.url.absolute(url);
      spf.nav.navigate(url);

      jasmine.Clock.tick(2 * MOCK_DELAY + 1);
      expect(spf.nav.navigate_.calls[1].args[0]).toEqual(url2);
      expect(spf.nav.navigate_.calls.length).toEqual(2);
    });


  });


  describe('dispatchError', function() {

    var url = '/page';
    var err = new Error();


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchError_(url, err);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('error');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchError_(url, err,
                                           {'onError': fn});
      var evtData = spf.dispatch.calls[0].args[1];
      var fnData = fn.calls[0].args[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchClick', function() {

    var url = '/page';
    var target = document.createElement('a');


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchClick_(url, target);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('click');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
      var proceed = spf.nav.dispatchClick_(url, target);
      expect(spf.dispatch).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


  });


  describe('dispatchHistory', function() {

    var url = '/page';


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchHistory_(url);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('history');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchRequest_(url, referer, previous);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('request');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchRequest_(url, referer, previous,
                                             {'onRequest': fn});
      var evtData = spf.dispatch.calls[0].args[1];
      var fnData = fn.calls[0].args[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchPartProcess', function() {

    var url = '/page';
    var partial = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchPartProcess_(url, partial);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('partprocess');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartProcess_(url, partial,
                                                 {'onPartProcess': fn});
      var evtData = spf.dispatch.calls[0].args[1];
      var fnData = fn.calls[0].args[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchPartDone', function() {

    var url = '/page';
    var partial = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchPartDone_(url, partial);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('partdone');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchPartDone_(url, partial,
                                              {'onPartDone': fn});
      var evtData = spf.dispatch.calls[0].args[1];
      var fnData = fn.calls[0].args[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchProcess', function() {

    var url = '/page';
    var response = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchProcess_(url, response);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('process');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchProcess_(url, response,
                                             {'onProcess': fn});
      var evtData = spf.dispatch.calls[0].args[1];
      var fnData = fn.calls[0].args[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


  describe('dispatchDone', function() {

    var url = '/page';
    var response = {};


    it('dispatches an event', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var proceed = spf.nav.dispatchDone_(url, response);
      var evtName = spf.dispatch.calls[0].args[0];
      expect(spf.dispatch).toHaveBeenCalled();
      expect(evtName).toEqual('done');
      expect(proceed).toBe(true);
    });


    it('dispatches an event and propagates cancellation', function() {
      spyOn(spf, 'dispatch').andReturn(false);
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
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('does not dispatch an event if events are skipped', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn}, true);
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(true);
    });


    it('does not dispatch an event if a callback is canceled', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn').andReturn(false);
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      expect(spf.dispatch).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalled();
      expect(proceed).toBe(false);
    });


    it('passes the same data to both events and callbacks', function() {
      spyOn(spf, 'dispatch').andCallThrough();
      var fn = jasmine.createSpy('fn');
      var proceed = spf.nav.dispatchDone_(url, response,
                                          {'onDone': fn});
      var evtData = spf.dispatch.calls[0].args[1];
      var fnData = fn.calls[0].args[0];
      expect(evtData).toEqual(fnData);
      expect(proceed).toBe(true);
    });


  });


});
