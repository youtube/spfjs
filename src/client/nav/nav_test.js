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


});
