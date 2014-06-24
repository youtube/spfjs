// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for dynamically loading styles.
 */

goog.require('spf.array');
goog.require('spf.net.resource');
goog.require('spf.net.style');


describe('spf.net.style', function() {

  var fakes;
  var nodes;
  var css = spf.net.resource.Type.CSS;
  var loading = spf.net.resource.Status.LOADING;
  var loaded = spf.net.resource.Status.LOADED;

  beforeEach(function() {
    jasmine.Clock.useMock();
    fakes = {
      // Replace DOM-based functions with fakes.
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
          var el = {
            setAttribute: function(n, v) {
              el[n] = v;
            },
            getAttribute: function(n) {
              return el[n];
            }
          };
          url = spf.net.resource.canonicalize(css, url);
          el.href = url;
          el.className = type + '-' + url.replace(/[^\w]/g, '');
          nodes.push(el);
          spf.net.resource.stats_[url] = loaded;
          opt_callback && opt_callback();
          return el;
        },
        destroy: function(type, url) {
          var idx = -1;
          spf.array.every(nodes, function(n, i, arr) {
            if (n.href == url) {
              idx = i;
              return false;
            }
            return true;
          });
          nodes.splice(idx, 1);
          delete spf.net.resource.stats_[url];
        }
      }
    };
    spyOn(spf.url, 'absolute').andCallFake(fakes.url.absolute);
    spyOn(spf.net.resource, 'create').andCallFake(
        fakes.resource.create);
    spyOn(spf.net.resource, 'destroy').andCallFake(
        fakes.resource.destroy);
    spf.state.values_ = {};
    spf.net.resource.urls_ = {};
    spf.net.resource.stats_ = {};
    nodes = [];
  });

  describe('load', function() {

    it('single url', function() {
      spf.net.style.load('url-a.css');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.style.load('url-a.css');
      jasmine.Clock.tick(1);
      spf.net.style.load('url-a.css');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.style.load('url-b.css');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
    });

    it('single url with name', function() {
      spf.net.style.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.style.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      spf.net.style.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.style.load('url-b.css', 'b');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
    });

    it('multiple urls', function() {
      spf.net.style.load(['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.style.load(['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      spf.net.style.load(['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.style.load(['url-b-1.css', 'url-b-2.css']);
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(4);
    });

    it('multiple urls with name', function() {
      spf.net.style.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.style.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      spf.net.style.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.style.load(['url-b-1.css', 'url-b-2.css'], 'b');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(4);
    });

  });

  describe('unload', function() {

    it('single url by name', function() {
      // Load a URL.
      spf.net.style.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      var result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('//test/url-a.css');
      // Unload it.
      spf.net.style.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('//test/url-a.css' in spf.net.resource.stats_).toBe(false);
      expect(result).not.toContain('//test/url-a.css');
      // Repeated calls should be no-ops.
      spf.net.style.unload('a');
      spf.net.style.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('//test/url-a.css' in spf.net.resource.stats_).toBe(false);
      expect(result).not.toContain('//test/url-a.css');
    });

    it('multiple urls by name', function() {
      // Load some URLs (and check that they are "ready").
      spf.net.style.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      var result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('//test/url-a-1.css');
      expect(result).toContain('//test/url-a-2.css');
      // Remove them (and check that they are no longer "ready").
      spf.net.style.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('//test/url-a-1.css' in spf.net.resource.stats_).toBe(false);
      expect('//test/url-a-2.css' in spf.net.resource.stats_).toBe(false);
      expect(result).not.toContain('//test/url-a-1.css');
      expect(result).not.toContain('//test/url-a-2.css');
      // Repeated calls should be no-ops.
      spf.net.style.unload('a');
      spf.net.style.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('//test/url-a-1.css' in spf.net.resource.stats_).toBe(false);
      expect('//test/url-a-2.css' in spf.net.resource.stats_).toBe(false);
      expect(result).not.toContain('//test/url-a-1.css');
      expect(result).not.toContain('//test/url-a-2.css');
      // Check multiple names.
      spf.net.style.load(['url-a-1.css', 'url-a-2.css'], 'a');
      spf.net.style.load(['url-b-1.css', 'url-b-2.css'], 'b');
      jasmine.Clock.tick(1);
      var result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('//test/url-a-1.css');
      expect(result).toContain('//test/url-a-2.css');
      expect(result).toContain('//test/url-b-1.css');
      expect(result).toContain('//test/url-b-2.css');
      spf.net.style.unload('b');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('//test/url-a-1.css');
      expect(result).toContain('//test/url-a-2.css');
      expect(result).not.toContain('//test/url-b-1.css');
      expect(result).not.toContain('//test/url-b-2.css');
      spf.net.style.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).not.toContain('//test/url-a-1.css');
      expect(result).not.toContain('//test/url-a-2.css');
      expect(result).not.toContain('//test/url-b-1.css');
      expect(result).not.toContain('//test/url-b-2.css');
    });

  });

});
