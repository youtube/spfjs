// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for handling the SPF config.
 */

goog.require('spf.config');


describe('spf.config', function() {

  beforeEach(function() {
    spf.config.defaults = {};
    spf.config.values = {};
  });


  describe('has', function() {

    it('checks values', function() {
      spf.config.values['foo'] = 'foo';
      expect(spf.config.has('foo')).toBe(true);
      expect(spf.config.has('bar')).toBe(false);
    });

  });

  describe('get', function() {

    it('gets values', function() {
      spf.config.values['foo'] = 'foo';
      expect(spf.config.get('foo')).toBe('foo');
      expect(spf.config.get('bar')).toBe(undefined);
    });

  });

  describe('set', function() {

    it('sets values', function() {
      var v = spf.config.set('foo', 'foo');
      expect(spf.config.values['foo']).toBe('foo');
      expect(v).toBe('foo');
      expect(spf.config.values['bar']).toBe(undefined);
    });

  });

  describe('clear', function() {

    it('clears values', function() {
      spf.config.set('foo', 'foo');
      expect(spf.config.has('foo')).toBe(true);
      spf.config.clear();
      expect(spf.config.has('foo')).toBe(false);
    });

  });

  describe('init', function() {

    it('uses defaults for values', function() {
      spf.config.defaults['foo'] = 'foo';
      spf.config.init();
      expect(spf.config.get('foo')).toBe('foo');
      expect(spf.config.get('bar')).toBe(undefined);
    });

    it('overrides defaults for values', function() {
      spf.config.defaults['foo'] = 'foo';
      spf.config.init({'foo': 'surprise!'});
      expect(spf.config.get('foo')).toBe('surprise!');
      expect(spf.config.get('bar')).toBe(undefined);
    });

    it('allows values without defaults', function() {
      spf.config.defaults['foo'] = 'foo';
      spf.config.init({'bar': 'bar'});
      expect(spf.config.get('foo')).toBe('foo');
      expect(spf.config.get('bar')).toBe('bar');
    });

  });

});
