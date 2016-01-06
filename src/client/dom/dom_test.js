// Copyright 2016 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for basic DOM manipulation functions.
 */

goog.require('spf.dom');
goog.require('spf.string');


describe('spf.dom', function() {


  describe('setAttributes', function() {

    it('sets "class" correctly', function() {
      var el = document.createElement('div');
      spf.dom.setAttributes(el, {'class': 'foo'});
      expect(el.className).toEqual('foo');
      expect(el.getAttribute('class')).toEqual('foo');
    });

    it('sets "style" correctly', function() {
      var el = document.createElement('span');
      spf.dom.setAttributes(el, {'style': 'display: block;'});
      // Note that some browsers add trailing whitespace to the
      // style text here, so trim it for the test.
      expect(spf.string.trim(el.style.cssText)).toEqual('display: block;');
      expect(spf.string.trim(el.getAttribute('style')))
          .toEqual('display: block;');
    });

    it('sets "value" correctly', function() {
      var el = document.createElement('input');
      spf.dom.setAttributes(el, {'value': 'bar'});
      expect(el.value).toEqual('bar');
      expect(el.getAttribute('value')).toEqual('bar');
    });

  });


});
