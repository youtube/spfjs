/**
 * @fileoverview Tests for dynamically loading styles.
 */

goog.require('spf.array');
goog.require('spf.net.resourcebeta');
goog.require('spf.net.stylebeta');


describe('spf.net.stylebeta', function() {

  var fakes;
  var urls;
  var stats;
  var nodes;
  var loading = spf.net.resourcebeta.Status.LOADING;
  var loaded = spf.net.resourcebeta.Status.LOADED;

  beforeEach(function() {
    jasmine.Clock.useMock();
    fakes = {
      // Replace DOM-based functions with fakes.
      resourcebeta: {
        create: function(type, url, opt_callback, opt_document) {
          var el = {};
          el.href = url;
          el.className = type + '-' + url.replace(/[^\w]/g, '');
          nodes.push(el);
          stats[url] = loaded;
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
          delete stats[url];
        }
      }
    };
    spyOn(spf.net.resourcebeta, 'create').andCallFake(
        fakes.resourcebeta.create);
    spyOn(spf.net.resourcebeta, 'destroy').andCallFake(
        fakes.resourcebeta.destroy);
    spf.state.values_ = {};
    urls = spf.net.resourcebeta.urls_ = {};
    stats = spf.net.resourcebeta.stats_ = {};
    nodes = [];
  });

  describe('load', function() {

    it('single url', function() {
      spf.net.stylebeta.load('url-a.css');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.stylebeta.load('url-a.css');
      jasmine.Clock.tick(1);
      spf.net.stylebeta.load('url-a.css');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.stylebeta.load('url-b.css');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
    });

    it('single url with name', function() {
      spf.net.stylebeta.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.stylebeta.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      spf.net.stylebeta.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(1);
      spf.net.stylebeta.load('url-b.css', 'b');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
    });

    it('multiple urls', function() {
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.stylebeta.load(['url-b-1.css', 'url-b-2.css']);
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(4);
    });

    it('multiple urls with name', function() {
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(2);
      spf.net.stylebeta.load(['url-b-1.css', 'url-b-2.css'], 'b');
      jasmine.Clock.tick(1);
      expect(nodes.length).toEqual(4);
    });

  });

  describe('unload', function() {

    it('single url by name', function() {
      // Load a URL.
      spf.net.stylebeta.load('url-a.css', 'a');
      jasmine.Clock.tick(1);
      var result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('url-a.css');
      // Unload it.
      spf.net.stylebeta.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('url-a.css' in stats).toBe(false);
      expect(result).not.toContain('url-a.css');
      // Repeated calls should be no-ops.
      spf.net.stylebeta.unload('a');
      spf.net.stylebeta.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('url-a.css' in stats).toBe(false);
      expect(result).not.toContain('url-a.css');
    });

    it('multiple urls by name', function() {
      // Load some URLs (and check that they are "ready").
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      var result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('url-a-1.css');
      expect(result).toContain('url-a-2.css');
      // Remove them (and check that they are no longer "ready").
      spf.net.stylebeta.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('url-a-1.css' in stats).toBe(false);
      expect('url-a-2.css' in stats).toBe(false);
      expect(result).not.toContain('url-a-1.css');
      expect(result).not.toContain('url-a-2.css');
      // Repeated calls should be no-ops.
      spf.net.stylebeta.unload('a');
      spf.net.stylebeta.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect('url-a-1.css' in stats).toBe(false);
      expect('url-a-2.css' in stats).toBe(false);
      expect(result).not.toContain('url-a-1.css');
      expect(result).not.toContain('url-a-2.css');
      // Check multiple names.
      spf.net.stylebeta.load(['url-a-1.css', 'url-a-2.css'], 'a');
      spf.net.stylebeta.load(['url-b-1.css', 'url-b-2.css'], 'b');
      jasmine.Clock.tick(1);
      var result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('url-a-1.css');
      expect(result).toContain('url-a-2.css');
      expect(result).toContain('url-b-1.css');
      expect(result).toContain('url-b-2.css');
      spf.net.stylebeta.unload('b');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).toContain('url-a-1.css');
      expect(result).toContain('url-a-2.css');
      expect(result).not.toContain('url-b-1.css');
      expect(result).not.toContain('url-b-2.css');
      spf.net.stylebeta.unload('a');
      result = spf.array.map(nodes, function(a) { return a.href; });
      expect(result).not.toContain('url-a-1.css');
      expect(result).not.toContain('url-a-2.css');
      expect(result).not.toContain('url-b-1.css');
      expect(result).not.toContain('url-b-2.css');
    });

  });

  describe('canonicalize_', function() {

    it('files', function() {
      var canonical = spf.net.stylebeta.canonicalize_('foo');
      expect(canonical).toEqual('foo.css');
      canonical = spf.net.stylebeta.canonicalize_('foo.css');
      expect(canonical).toEqual('foo.css');
      canonical = spf.net.stylebeta.canonicalize_('foo.css.extra');
      expect(canonical).toEqual('foo.css.extra');
      // With a base.
      spf.net.stylebeta.path('/base/');
      canonical = spf.net.stylebeta.canonicalize_('foo');
      expect(canonical).toEqual('/base/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('foo.css');
      expect(canonical).toEqual('/base/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('foo.css.extra');
      expect(canonical).toEqual('/base/foo.css.extra');
    });

    it('relative paths', function() {
      var canonical = spf.net.stylebeta.canonicalize_('path/foo');
      expect(canonical).toEqual('path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('path/foo.css');
      expect(canonical).toEqual('path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('path/foo.css.extra');
      expect(canonical).toEqual('path/foo.css.extra');
      // With a base.
      spf.net.stylebeta.path('/base/');
      canonical = spf.net.stylebeta.canonicalize_('path/foo');
      expect(canonical).toEqual('/base/path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('path/foo.css');
      expect(canonical).toEqual('/base/path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('path/foo.css.extra');
      expect(canonical).toEqual('/base/path/foo.css.extra');
    });

    it('absolute paths', function() {
      var canonical = spf.net.stylebeta.canonicalize_('/path/foo');
      expect(canonical).toEqual('/path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('/path/foo.css');
      expect(canonical).toEqual('/path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('/path/foo.css.extra');
      expect(canonical).toEqual('/path/foo.css.extra');
      // With a base.
      spf.net.stylebeta.path('http://domain');
      canonical = spf.net.stylebeta.canonicalize_('/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('/path/foo.css');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.stylebeta.canonicalize_('/path/foo.css.extra');
      expect(canonical).toEqual('http://domain/path/foo.css.extra');
    });

    it('urls', function() {
      var unprotocol = '//domain/path/bar.css';
      var http = 'http://domain/path/bar.css';
      var https = 'https://domain/path/bar.css';
      var local = 'file:///user/folder/bar.css';
      expect(spf.net.stylebeta.canonicalize_(unprotocol)).toEqual(unprotocol);
      expect(spf.net.stylebeta.canonicalize_(http)).toEqual(http);
      expect(spf.net.stylebeta.canonicalize_(https)).toEqual(https);
      expect(spf.net.stylebeta.canonicalize_(local)).toEqual(local);
      // With a base.
      spf.net.stylebeta.path('http://otherdomain/otherpath/');
      expect(spf.net.stylebeta.canonicalize_(unprotocol)).toEqual(unprotocol);
      expect(spf.net.stylebeta.canonicalize_(http)).toEqual(http);
      expect(spf.net.stylebeta.canonicalize_(https)).toEqual(https);
      expect(spf.net.stylebeta.canonicalize_(local)).toEqual(local);
    });

  });

  describe('prefix_', function() {

    it('adds prefixes', function() {
      expect(spf.net.stylebeta.prefix_('foo')).toEqual('css-foo');
    });

  });

  describe('label_', function() {

    it('removes special characters', function() {
      var name = spf.net.stylebeta.label_('foo~!@#$%^&');
      expect(name).toEqual('foo');
      name = spf.net.stylebeta.label_('*+-=()[]{}|foo');
      expect(name).toEqual('foo');
      name = spf.net.stylebeta.label_('`\\;:"foo,./<>?');
      expect(name).toEqual('foo');
      name = spf.net.stylebeta.label_('foo\uD83D\uDCA9');
      expect(name).toEqual('foo');
    });

  });

});

