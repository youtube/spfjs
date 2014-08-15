// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for dynamically loading scripts.
 */

goog.require('spf.array');
goog.require('spf.net.resource');
goog.require('spf.net.script');
goog.require('spf.pubsub');
goog.require('spf.state');
goog.require('spf.url');


describe('spf.net.script', function() {

  var JS = spf.net.resource.Type.JS;
  var nodes;
  var callbacks;
  var fakes = {
    url: {
      absolute: function(relative) {
        if (relative.indexOf('//') > -1) {
          return relative;
        } else if (relative.indexOf('/') == 0) {
          return '//test' + relative;
        } else {
          return '//test/' + relative;
        }
      }
    },
    resource: {
      create: function(type, url, opt_callback, opt_document) {
        url = spf.net.resource.canonicalize(JS, url);
        var el = {
          setAttribute: function(n, v) {
            el[n] = v;
          },
          getAttribute: function(n) {
            return el[n];
          }
        };
        el.src = url;
        el.className = type + '-' + url.replace(/[^\w]/g, '');
        nodes.push(el);
        var key = type + '-' + url;
        spf.net.resource.status_[key] = spf.net.resource.State.LOADED;
        opt_callback && opt_callback();
        return el;
      },
      destroy: function(type, url) {
        var idx = -1;
        spf.array.every(nodes, function(n, i, arr) {
          if (n.src == url) {
            idx = i;
            return false;
          }
          return true;
        });
        nodes.splice(idx, 1);
        var key = type + '-' + url;
        delete spf.net.resource.status_[key];
      }
    }
  };


  beforeEach(function() {
    jasmine.Clock.useMock();


    spf.state.values_ = {};
    spf.pubsub.subscriptions = {};
    spf.net.script.urls_ = {};
    spf.net.script.deps_ = {};
    spf.net.resource.urls_ = {};
    spf.net.resource.status_ = {};

    nodes = [];
    callbacks = {
      one: jasmine.createSpy('one'),
      two: jasmine.createSpy('two'),
      three: jasmine.createSpy('three'),
      four: jasmine.createSpy('four')
    };

    spyOn(spf.net.resource, 'load').andCallThrough();
    spyOn(spf.net.resource, 'unload').andCallThrough();
    spyOn(spf.net.resource, 'create').andCallFake(fakes.resource.create);
    spyOn(spf.net.resource, 'destroy').andCallFake(fakes.resource.destroy);
    spyOn(spf.net.resource, 'prefetch');

    spyOn(spf.url, 'absolute').andCallFake(fakes.url.absolute);

    for (var i = 1; i < 9; i++) {
      window['_global_' + i + '_'] = undefined;
    }
  });


  describe('load', function() {

    it('passes a single url', function() {
      var url = 'url-a.js';
      spf.net.script.load(url);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, url, undefined, undefined);
    });

    it('passes a single url with name', function() {
      var url = 'url-a.js';
      var name = 'a';
      spf.net.script.load(url, name);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, url, name, undefined);
    });

    it('passes a single url with callback', function() {
      var url = 'url-a.js';
      var fn = function() {};
      spf.net.script.load(url, fn);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, url, fn, undefined);
    });

    it('passes a single url with name and callback', function() {
      var url = 'url-a.js';
      var name = 'a';
      var fn = function() {};
      spf.net.script.load(url, name, fn);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, url, name, fn);
    });

    it('passes multiple urls', function() {
      var urls = ['url-a-1.js', 'url-a-2.js'];
      spf.net.script.load(urls);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, urls, undefined, undefined);
    });

    it('passes multiple urls with name', function() {
      var urls = ['url-a-1.js', 'url-a-2.js'];
      var name = 'a';
      spf.net.script.load(urls, name);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, urls, name, undefined);
    });

    it('passes multiple urls with callback', function() {
      var urls = ['url-a-1.js', 'url-a-2.js'];
      var fn = function() {};
      spf.net.script.load(urls, fn);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, urls, fn, undefined);
    });

    it('passes multiple urls with name and callback', function() {
      var urls = ['url-a-1.js', 'url-a-2.js'];
      var name = 'a';
      var fn = function() {};
      spf.net.script.load(urls, name, fn);
      expect(spf.net.resource.load).toHaveBeenCalledWith(
          JS, urls, name, fn);
    });

  });


  describe('unload', function() {

    it('passes name', function() {
      var name = 'a';
      spf.net.script.unload(name);
      expect(spf.net.resource.unload).toHaveBeenCalledWith(JS, name);
    });

  });


  describe('get', function() {

    it('passes url', function() {
      var url = 'url-a.js';
      spf.net.script.get(url);
      expect(spf.net.resource.create).toHaveBeenCalledWith(
          JS, url, undefined);
    });

    it('passes url with function', function() {
      var url = 'url-a.js';
      var fn = function() {};
      spf.net.script.get(url, fn);
      expect(spf.net.resource.create).toHaveBeenCalledWith(
          JS, url, fn);
    });

  });


  describe('prefetch', function() {

    it('calls for a single url', function() {
      var url = 'url-a.js';
      spf.net.script.prefetch(url);
      expect(spf.net.resource.prefetch).toHaveBeenCalledWith(
          JS, url);
    });

    it('calls for multiples urls', function() {
      var urls = ['url-a-1.js', 'url-a-2.js'];
      spf.net.script.prefetch(urls);
      spf.array.each(urls, function(url) {
        expect(spf.net.resource.prefetch).toHaveBeenCalledWith(
            JS, url);
      });
    });

  });


  describe('ready', function() {

    it('waits to execute callbacks on a single dependency', function() {
      // Check pre-ready.
      spf.net.script.ready('my:foo', callbacks.one);
      expect(callbacks.one.calls.length).toEqual(0);
      // Load.
      spf.net.script.load('foo.js', 'my:foo');
      jasmine.Clock.tick(1);
      // Check post-ready.
      expect(callbacks.one.calls.length).toEqual(1);
      // Check again.
      spf.net.script.ready('my:foo', callbacks.two);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(1);
      spf.net.script.ready('my:foo', callbacks.two);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(2);
    });

    it('waits to execute callbacks on multiple dependencies', function() {
      spf.net.script.ready('my:foo', callbacks.one);
      spf.net.script.ready('bar', callbacks.two);
      spf.net.script.ready(['my:foo', 'bar'], callbacks.three);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      // Load first.
      spf.net.script.load('foo.js', 'my:foo');
      jasmine.Clock.tick(1);
      // Check.
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      // Load second.
      spf.net.script.load('bar.js', 'bar');
      jasmine.Clock.tick(1);
      // Check.
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(1);
      expect(callbacks.three.calls.length).toEqual(1);
      // Check again.
      spf.net.script.ready('bar', callbacks.two);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(2);
      expect(callbacks.three.calls.length).toEqual(1);
      spf.net.script.ready(['my:foo', 'bar'], callbacks.three);
      spf.net.script.ready(['my:foo', 'bar'], callbacks.three);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(2);
      expect(callbacks.three.calls.length).toEqual(3);
    });

    it('executes require for missing dependencies', function() {
      spf.net.script.ready('my:foo', null, callbacks.one);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.one.mostRecentCall.args[0]).toEqual(['my:foo']);
      // Load first.
      spf.net.script.load('foo.js', 'my:foo');
      spf.net.script.ready(['my:foo', 'bar'], null, callbacks.one);
      jasmine.Clock.tick(1);
      expect(callbacks.one.calls.length).toEqual(2);
      expect(callbacks.one.mostRecentCall.args[0]).toEqual(['bar']);
      // Load second.
      spf.net.script.load('bar.js', 'bar');
      spf.net.script.ready(['a', 'my:foo', 'b', 'bar', 'c'],
                               null, callbacks.one);
      jasmine.Clock.tick(1);
      expect(callbacks.one.calls.length).toEqual(3);
      expect(callbacks.one.mostRecentCall.args[0]).toEqual(['a', 'b', 'c']);
    });

  });


  describe('done', function() {

    it('registers completion', function() {
      spf.net.script.done('foo');
      expect('foo' in spf.net.resource.urls_);
    });

    it('executes callbacks', function() {
      // Setup callbacks.
      spf.net.script.ready('foo', callbacks.one);
      spf.net.script.ready('bar', callbacks.two);
      // Register first.
      spf.net.script.done('foo');
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(0);
      // Register second.
      spf.net.script.done('bar');
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(1);
      // Repeat.
      spf.net.script.ready('foo', callbacks.one);
      spf.net.script.ready('bar', callbacks.two);
      expect(callbacks.one.calls.length).toEqual(2);
      expect(callbacks.two.calls.length).toEqual(2);
      // Extra.
      spf.net.script.done('foo');
      spf.net.script.done('foo');
      spf.net.script.done('bar');
      expect(callbacks.one.calls.length).toEqual(2);
      expect(callbacks.two.calls.length).toEqual(2);
    });

  });


  describe('ignore', function() {

    it('does not execute callbacks for a single dependency', function() {
      spf.net.script.ready('foo', callbacks.one);
      spf.net.script.ignore('foo', callbacks.one);
      spf.net.script.done('foo');
      expect(callbacks.one.calls.length).toEqual(0);
    });

    it('does not execute callbacks for multiple dependencies', function() {
      spf.net.script.ready(['a', 'b', 'c'], callbacks.one);
      // Ensure a different ordering works.
      spf.net.script.ignore(['c', 'b', 'a'], callbacks.one);
      spf.net.script.done('a');
      spf.net.script.done('b');
      spf.net.script.done('c');
      expect(callbacks.one.calls.length).toEqual(0);
    });

  });


  describe('require', function() {

    it('loads declared dependencies', function() {
      spyOn(spf.net.script, 'ready').andCallThrough();
      spf.net.script.declare({
        'foo': null,
        'a': 'foo',
        'b': 'foo',
        'bar': ['a', 'b']
      });
      spf.net.script.require('bar', callbacks.one);
      jasmine.Clock.tick(1);
      // Check ready ordering.
      expect(spf.net.script.ready.calls.length).toEqual(4);
      expect(spf.net.script.ready.calls[0].args[0]).toEqual(['bar']);
      expect(spf.net.script.ready.calls[1].args[0]).toEqual(['a', 'b']);
      expect(spf.net.script.ready.calls[2].args[0]).toEqual(['foo']);
      expect(spf.net.script.ready.calls[3].args[0]).toEqual(['foo']);
      // Check load ordering.
      var result = spf.array.map(nodes, function(a) { return a.src; });
      expect(result).toEqual(['//test/foo.js', '//test/a.js',
                              '//test/b.js', '//test/bar.js']);
      // Check callback.
      expect(callbacks.one.calls.length).toEqual(1);
      // Repeat callback.
      spf.net.script.require('bar', callbacks.one);
      expect(spf.net.script.ready.calls.length).toEqual(5);
      expect(spf.net.script.ready.calls[4].args[0]).toEqual(['bar']);
      expect(callbacks.one.calls.length).toEqual(2);
      // No callback.
      spf.net.script.require('bar');
      expect(spf.net.script.ready.calls.length).toEqual(6);
      expect(spf.net.script.ready.calls[5].args[0]).toEqual(['bar']);
      expect(callbacks.one.calls.length).toEqual(2);
    });

    it('loads declared dependencies with path', function() {
      spf.net.script.path('/dir/');
      spf.net.script.declare({
        'foo': null,
        'a': 'foo',
        'b': 'foo',
        'bar': ['a', 'b']
      });
      spf.net.script.require('bar', callbacks.one);
      jasmine.Clock.tick(1);
      // Check load ordering.
      var result = spf.array.map(nodes, function(a) { return a.src; });
      expect(result).toEqual(['//test/dir/foo.js', '//test/dir/a.js',
                              '//test/dir/b.js', '//test/dir/bar.js']);
      // Check callback.
      expect(callbacks.one.calls.length).toEqual(1);
    });

    it('loads declared dependencies with urls', function() {
      spf.net.script.declare({
        'foo': null,
        'a': 'foo',
        'b': 'foo',
        'bar': ['a', 'b']
      }, {
        'foo': 'sbb.js',
        'a': 'n.js',
        'b': 'o.js',
        'bar': 'one.js'
      });
      spf.net.script.require('bar', callbacks.one);
      jasmine.Clock.tick(1);
      // Check load ordering.
      var result = spf.array.map(nodes, function(a) { return a.src; });
      expect(result).toEqual(['//test/sbb.js', '//test/n.js',
                              '//test/o.js', '//test/one.js']);
      // Check callback.
      expect(callbacks.one.calls.length).toEqual(1);
    });

    it('loads declared dependencies with path and urls', function() {
      spf.net.script.path('/dir/');
      spf.net.script.declare({
        'foo': null,
        'a': 'foo',
        'b': 'foo',
        'bar': ['a', 'b']
      }, {
        'foo': 'sbb.js',
        'a': 'n.js',
        'b': 'o.js',
        'bar': 'one.js'
      });
      spf.net.script.require('bar', callbacks.one);
      jasmine.Clock.tick(1);
      // Check load ordering.
      var result = spf.array.map(nodes, function(a) { return a.src; });
      expect(result).toEqual(['//test/dir/sbb.js', '//test/dir/n.js',
                              '//test/dir/o.js', '//test/dir/one.js']);
      // Check callback.
      expect(callbacks.one.calls.length).toEqual(1);
    });

  });


  describe('exec', function() {

    it('standard', function() {
      expect(function() { spf.net.script.exec(''); }).not.toThrow();
      var text = 'var _global_1_ = 1;';
      spf.net.script.exec(text);
      expect(window['_global_1_']).toEqual(1);
    });

    it('strict', function() {
      var text = '"use strict";' +
          'var _global_2_ = 2;';
      spf.net.script.exec(text);
      expect(window['_global_2_']).toEqual(2);
    });

    it('recursive standard', function() {
      text = 'var _global_3_ = 3;' +
          'spf.net.script.exec("var _global_4_ = 4;");';
      spf.net.script.exec(text);
      expect(window['_global_3_']).toEqual(3);
      expect(window['_global_4_']).toEqual(4);
    });

    it('recursive mixed', function() {
      text = 'var _global_5_ = 5;' +
          'spf.net.script.exec("' +
          "'use strict';" +
          'var _global_6_ = 6;' +
          '");';
      spf.net.script.exec(text);
      expect(window['_global_5_']).toEqual(5);
      expect(window['_global_6_']).toEqual(6);
    });

    it('recursive strict', function() {
      text = '"use strict";' +
          'var _global_7_ = 7;' +
          'spf.net.script.exec("' +
          "'use strict';" +
          'var _global_8_ = 8;' +
          '");';
      spf.net.script.exec(text);
      expect(window['_global_7_']).toEqual(7);
      expect(window['_global_8_']).toEqual(8);
    });

  });


});
