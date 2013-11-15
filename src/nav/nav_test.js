/**
 * @fileoverview Tests for navigation-related core functions.
 */

goog.require('spf');
goog.require('spf.nav');


describe('spf.nav', function() {

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
  var objFunc = function() { return {}; };
  var nullFunc = function() { return null; };


  beforeEach(function(argument) {
    spf.nav.navigate_ = jasmine.createSpy('spf.nav.navigate_');
  });


  afterEach(function() {
    spf.config.clear();
  });


  describe('handleClick_', function() {


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
      spyOn(spf.nav, 'getAncestorWithNoLinkClass_').andCallFake(objFunc);
      spf.config.set('nolink-class', 'NOLINK_CLASS');

      var evt = createFakeBrowserEvent();
      spf.nav.handleClick_(evt);

      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without href', function() {
      spyOn(spf.nav, 'getAncestorWithHref_').andCallFake(nullFunc);
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(objFunc);

      var evt = createFakeBrowserEvent();
      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithHref_).toHaveBeenCalled();
      expect(evt.defaultPrevented).toEqual(false);
      expect(spf.nav.navigate_).not.toHaveBeenCalled();
    });


    it('ignores click without link class', function() {
      spyOn(spf.nav, 'getAncestorWithLinkClass_').andCallFake(nullFunc);

      var evt = createFakeBrowserEvent();
      spf.nav.handleClick_(evt);

      expect(spf.nav.getAncestorWithLinkClass_).toHaveBeenCalled();
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


});
