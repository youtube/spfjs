// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for loading and unloading external resources.
 */

goog.require('spf.array');
goog.require('spf.net.resource');
goog.require('spf.pubsub');
goog.require('spf.state');
goog.require('spf.url');


describe('spf.net.resource', function() {

  var JS = spf.net.resource.Type.JS;
  var CSS = spf.net.resource.Type.CSS;
  var LOADING = spf.net.resource.State.LOADING;
  var LOADED = spf.net.resource.State.LOADED;
  var nodes;
  var callbacks;
  var reals = {
    resource: {
      create: spf.net.resource.create,
      destroy: spf.net.resource.destroy
    }
  };
  var fakes = {
    doc: {
      createElement: function(tagName) {
        return new FakeElement(tagName);
      },
      getElementsByTagName: function(tagName) {
        tagName = tagName.toUpperCase();
        return spf.array.filter(nodes, function(n) {
          return n.tagName == tagName;
        });
      },
      querySelectorAll: function(selector) {
        // Only class matching is supported here.
        var className = selector.substring(1);
        return spf.array.filter(nodes, function(n) {
          return n.className == className;
        });
      }
    },
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
      create: function(type, url, opt_callback) {
        var el = reals.resource.create(type, url, opt_callback, fakes.doc);
        setTimeout(el.onload, 0);
        return el;
      },
      destroy: function(type, url) {
        reals.resource.destroy(type, url, fakes.doc);
      }
    }
  };

  var FakeElement = function(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.onload = function() {};
    // Fake parentNode reference to allow "el.parentNode.removeChild" calls.
    this.parentNode = this;
  };
  FakeElement.prototype.getAttribute = function(name) {
    return this.attributes[name];
  };
  FakeElement.prototype.setAttribute = function(name, value) {
    this.attributes[name] = value;
  };
  FakeElement.prototype.insertBefore = function(el, ref) {
    nodes.unshift(el);
  };
  FakeElement.prototype.appendChild = function(el) {
    nodes.push(el);
  };
  FakeElement.prototype.removeChild = function(el) {
    var idx = -1;
    spf.array.every(nodes, function(n, i, arr) {
      if (n == el) {
        idx = i;
        return false;
      }
      return true;
    });
    nodes.splice(idx, 1);
  };

  var getScriptEls = function() {
    return fakes.doc.getElementsByTagName('script');
  };
  var getScriptUrls = function() {
    return spf.array.map(getScriptEls(), function(a) { return a.src; });
  };
  var getStyleEls = function() {
    return fakes.doc.getElementsByTagName('link');
  };
  var getStyleUrls = function() {
    return spf.array.map(getStyleEls(), function(a) { return a.href; });
  };


  beforeEach(function() {
    jasmine.Clock.useMock();

    spf.state.values_ = {};
    spf.pubsub.subscriptions = {};
    spf.net.resource.urls_ = {};
    spf.net.resource.status_ = {};

    nodes = [new FakeElement('head')];
    callbacks = {
      one: jasmine.createSpy('one'),
      two: jasmine.createSpy('two'),
      three: jasmine.createSpy('three'),
      four: jasmine.createSpy('four')
    };

    spyOn(spf.url, 'absolute').andCallFake(fakes.url.absolute);
    spyOn(spf.net.resource, 'create').andCallFake(fakes.resource.create);
    spyOn(spf.net.resource, 'destroy').andCallFake(fakes.resource.destroy);
  });


  describe('load', function() {

    it('a single url (script)', function() {
      spf.net.resource.load(JS, 'url-a.js');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(1);
      spf.net.resource.load(JS, 'url-a.js');
      jasmine.Clock.tick(1);
      spf.net.resource.load(JS, 'url-a.js');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(1);
      spf.net.resource.load(JS, 'url-b.js');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(2);
    });

    it('a single url (style)', function() {
      spf.net.resource.load(CSS, 'url-a.css');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(1);
      spf.net.resource.load(CSS, 'url-a.css');
      jasmine.Clock.tick(1);
      spf.net.resource.load(CSS, 'url-a.css');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(1);
      spf.net.resource.load(CSS, 'url-b.css');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(2);
    });

    it('a single url with a name (script)', function() {
      spf.net.resource.load(JS, 'url-a.js', 'a');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(1);
      spf.net.resource.load(JS, 'url-a.js', 'a');
      jasmine.Clock.tick(1);
      spf.net.resource.load(JS, 'url-a.js', 'a');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(1);
      spf.net.resource.load(JS, 'url-b.js', 'b');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(2);
    });

    it('a single url with a name (style)', function() {
      spf.net.resource.load(CSS, 'url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(1);
      spf.net.resource.load(CSS, 'url-a.css', 'a');
      jasmine.Clock.tick(1);
      spf.net.resource.load(CSS, 'url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(1);
      spf.net.resource.load(CSS, 'url-b.css', 'b');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(2);
    });

    it('multiple urls (script)', function() {
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js']);
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(2);
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js']);
      jasmine.Clock.tick(1);
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js']);
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(2);
      spf.net.resource.load(JS, ['url-b-1.js', 'url-b-2.js']);
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(4);
    });

    it('multiple urls (style)', function() {
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(2);
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css']);
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(2);
      spf.net.resource.load(CSS, ['url-b-1.css', 'url-b-2.css']);
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(4);
    });

    it('multiple urls with a name (script)', function() {
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js'], 'a');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(2);
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js'], 'a');
      jasmine.Clock.tick(1);
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js'], 'a');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(2);
      spf.net.resource.load(JS, ['url-b-1.js', 'url-b-2.js'], 'b');
      jasmine.Clock.tick(1);
      expect(getScriptEls().length).toEqual(4);
    });

    it('multiple urls with a name (style)', function() {
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(2);
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(2);
      spf.net.resource.load(CSS, ['url-b-1.css', 'url-b-2.css'], 'b');
      jasmine.Clock.tick(1);
      expect(getStyleEls().length).toEqual(4);
    });

  });


  describe('unload', function() {

    it('a single url by name (script)', function() {
      // Load a URL.
      spf.net.resource.load(JS, 'url-a.js', 'a');
      jasmine.Clock.tick(1);
      expect(getScriptUrls()).toContain('//test/url-a.js');
      // Unload it.
      spf.net.resource.unload(JS, 'a');
      expect('//test/url-a.js' in spf.net.resource.status_).toBe(false);
      expect(getScriptUrls()).not.toContain('//test/url-a.js');
      // Repeated calls should be no-ops.
      spf.net.resource.unload(JS, 'a');
      spf.net.resource.unload(JS, 'a');
      expect('//test/url-a.js' in spf.net.resource.status_).toBe(false);
      expect(getScriptUrls()).not.toContain('//test/url-a.js');
    });

    it('a single url by name (style)', function() {
      // Load a URL.
      spf.net.resource.load(CSS, 'url-a.css', 'a');
      jasmine.Clock.tick(1);
      expect(getStyleUrls()).toContain('//test/url-a.css');
      // Unload it.
      spf.net.resource.unload(CSS, 'a');
      expect('//test/url-a.css' in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain('//test/url-a.css');
      // Repeated calls should be no-ops.
      spf.net.resource.unload(CSS, 'a');
      spf.net.resource.unload(CSS, 'a');
      expect('//test/url-a.css' in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain('//test/url-a.css');
    });

    it('multiple urls by name (script)', function() {
      // Load some URLs (and check that they are "ready").
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js'], 'a');
      jasmine.Clock.tick(1);
      expect(getScriptUrls()).toContain('//test/url-a-1.js');
      expect(getScriptUrls()).toContain('//test/url-a-2.js');
      // Remove them (and check that they are no longer "ready").
      spf.net.resource.unload(JS, 'a');
      expect('//test/url-a-1.js' in spf.net.resource.status_).toBe(false);
      expect('//test/url-a-2.js' in spf.net.resource.status_).toBe(false);
      expect(getScriptUrls()).not.toContain('//test/url-a-1.js');
      expect(getScriptUrls()).not.toContain('//test/url-a-2.js');
      // Repeated calls should be no-ops.
      spf.net.resource.unload(JS, 'a');
      spf.net.resource.unload(JS, 'a');
      expect('//test/url-a-1.js' in spf.net.resource.status_).toBe(false);
      expect('//test/url-a-2.js' in spf.net.resource.status_).toBe(false);
      expect(getScriptUrls()).not.toContain('//test/url-a-1.js');
      expect(getScriptUrls()).not.toContain('//test/url-a-2.js');
      // Check multiple names.
      spf.net.resource.load(JS, ['url-a-1.js', 'url-a-2.js'], 'a');
      spf.net.resource.load(JS, ['url-b-1.js', 'url-b-2.js'], 'b');
      jasmine.Clock.tick(1);
      expect(getScriptUrls()).toContain('//test/url-a-1.js');
      expect(getScriptUrls()).toContain('//test/url-a-2.js');
      expect(getScriptUrls()).toContain('//test/url-b-1.js');
      expect(getScriptUrls()).toContain('//test/url-b-2.js');
      spf.net.resource.unload(JS, 'b');
      expect(getScriptUrls()).toContain('//test/url-a-1.js');
      expect(getScriptUrls()).toContain('//test/url-a-2.js');
      expect(getScriptUrls()).not.toContain('//test/url-b-1.js');
      expect(getScriptUrls()).not.toContain('//test/url-b-2.js');
      spf.net.resource.unload(JS, 'a');
      expect(getScriptUrls()).not.toContain('//test/url-a-1.js');
      expect(getScriptUrls()).not.toContain('//test/url-a-2.js');
      expect(getScriptUrls()).not.toContain('//test/url-b-1.js');
      expect(getScriptUrls()).not.toContain('//test/url-b-2.js');
    });

    it('multiple urls by name (style)', function() {
      // Load some URLs (and check that they are "ready").
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css'], 'a');
      jasmine.Clock.tick(1);
      expect(getStyleUrls()).toContain('//test/url-a-1.css');
      expect(getStyleUrls()).toContain('//test/url-a-2.css');
      // Remove them (and check that they are no longer "ready").
      spf.net.resource.unload(CSS, 'a');
      expect('//test/url-a-1.css' in spf.net.resource.status_).toBe(false);
      expect('//test/url-a-2.css' in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain('//test/url-a-1.css');
      expect(getStyleUrls()).not.toContain('//test/url-a-2.css');
      // Repeated calls should be no-ops.
      spf.net.resource.unload(CSS, 'a');
      spf.net.resource.unload(CSS, 'a');
      expect('//test/url-a-1.css' in spf.net.resource.status_).toBe(false);
      expect('//test/url-a-2.css' in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain('//test/url-a-1.css');
      expect(getStyleUrls()).not.toContain('//test/url-a-2.css');
      // Check multiple names.
      spf.net.resource.load(CSS, ['url-a-1.css', 'url-a-2.css'], 'a');
      spf.net.resource.load(CSS, ['url-b-1.css', 'url-b-2.css'], 'b');
      jasmine.Clock.tick(1);
      expect(getStyleUrls()).toContain('//test/url-a-1.css');
      expect(getStyleUrls()).toContain('//test/url-a-2.css');
      expect(getStyleUrls()).toContain('//test/url-b-1.css');
      expect(getStyleUrls()).toContain('//test/url-b-2.css');
      spf.net.resource.unload(CSS, 'b');
      expect(getStyleUrls()).toContain('//test/url-a-1.css');
      expect(getStyleUrls()).toContain('//test/url-a-2.css');
      expect(getStyleUrls()).not.toContain('//test/url-b-1.css');
      expect(getStyleUrls()).not.toContain('//test/url-b-2.css');
      spf.net.resource.unload(CSS, 'a');
      expect(getStyleUrls()).not.toContain('//test/url-a-1.css');
      expect(getStyleUrls()).not.toContain('//test/url-a-2.css');
      expect(getStyleUrls()).not.toContain('//test/url-b-1.css');
      expect(getStyleUrls()).not.toContain('//test/url-b-2.css');
    });

  });


  describe('check', function() {

    it('executes pending callbacks (script)', function() {
      // No dependencies.
      spf.pubsub.subscribe('js-foo', callbacks.one);
      spf.pubsub.subscribe('js-bar', callbacks.two);
      spf.pubsub.subscribe('js-foo|bar', callbacks.three);
      spf.pubsub.subscribe('js-other', callbacks.four);
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // Not loaded.
      spf.net.resource.urls_['js-foo'] = ['//test/f1.js', '//test/f2.js'];
      spf.net.resource.urls_['js-bar'] = ['//test/b.js'];
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // Some loading.
      spf.net.resource.status_['js-//test/b.js'] = LOADING;
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // All loading.
      spf.net.resource.status_['js-//test/b.js'] = LOADING;
      spf.net.resource.status_['js-//test/f1.js'] = LOADING;
      spf.net.resource.status_['js-//test/f2.js'] = LOADING;
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // Some loaded, some loading.
      spf.net.resource.status_['js-//test/b.js'] = LOADED;
      spf.net.resource.status_['js-//test/f1.js'] = LOADING;
      spf.net.resource.status_['js-//test/f2.js'] = LOADED;
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(1);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // All loaded.
      spf.net.resource.status_['js-//test/b.js'] = LOADED;
      spf.net.resource.status_['js-//test/f1.js'] = LOADED;
      spf.net.resource.status_['js-//test/f2.js'] = LOADED;
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(1);
      expect(callbacks.three.calls.length).toEqual(1);
      expect(callbacks.four.calls.length).toEqual(0);
    });

    it('executes pending callbacks (style)', function() {
      // No dependencies.
      spf.pubsub.subscribe('css-foo', callbacks.one);
      spf.pubsub.subscribe('css-bar', callbacks.two);
      spf.pubsub.subscribe('css-foo|bar', callbacks.three);
      spf.pubsub.subscribe('css-other', callbacks.four);
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // Not loaded.
      spf.net.resource.urls_['css-foo'] = ['//test/f1.css', '//test/f2.css'];
      spf.net.resource.urls_['css-bar'] = ['//test/b.css'];
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // Some loading.
      spf.net.resource.status_['css-//test/b.css'] = LOADING;
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // All loading.
      spf.net.resource.status_['css-//test/b.css'] = LOADING;
      spf.net.resource.status_['css-//test/f1.css'] = LOADING;
      spf.net.resource.status_['css-//test/f2.css'] = LOADING;
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(0);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // Some loaded, some loading.
      spf.net.resource.status_['css-//test/b.css'] = LOADED;
      spf.net.resource.status_['css-//test/f1.css'] = LOADING;
      spf.net.resource.status_['css-//test/f2.css'] = LOADED;
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.length).toEqual(0);
      expect(callbacks.two.calls.length).toEqual(1);
      expect(callbacks.three.calls.length).toEqual(0);
      expect(callbacks.four.calls.length).toEqual(0);
      // All loaded.
      spf.net.resource.status_['css-//test/b.css'] = LOADED;
      spf.net.resource.status_['css-//test/f1.css'] = LOADED;
      spf.net.resource.status_['css-//test/f2.css'] = LOADED;
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.length).toEqual(1);
      expect(callbacks.two.calls.length).toEqual(1);
      expect(callbacks.three.calls.length).toEqual(1);
      expect(callbacks.four.calls.length).toEqual(0);
    });

  });


  describe('prefix', function() {

    it('adds prefixes (script)', function() {
      expect(spf.net.resource.prefix(JS, 'foo')).toEqual('js-foo');
    });

    it('adds prefixes (sytle)', function() {
      expect(spf.net.resource.prefix(CSS, 'foo')).toEqual('css-foo');
    });

  });


  describe('label', function() {

    it('removes special characters', function() {
      var name = spf.net.resource.label('foo~!@#$%^&');
      expect(name).toEqual('foo');
      name = spf.net.resource.label('*+-=()[]{}|foo');
      expect(name).toEqual('foo');
      name = spf.net.resource.label('`\\;:"foo,./<>?');
      expect(name).toEqual('foo');
      name = spf.net.resource.label('foo\uD83D\uDCA9');
      expect(name).toEqual('foo');
    });

  });


  describe('canonicalize', function() {

    it('files (script)', function() {
      var canonical = spf.net.resource.canonicalize(JS, 'foo');
      expect(canonical).toEqual('//test/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'foo.js');
      expect(canonical).toEqual('//test/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'foo.js.extra');
      expect(canonical).toEqual('//test/foo.js.extra');
      // With a path.
      spf.net.resource.path(JS, '/path/');
      canonical = spf.net.resource.canonicalize(JS, 'foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With remapping.
      spf.net.resource.path(JS, {
        '': 'path/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(JS, 'foo');
      expect(canonical).toEqual('//test/path/bar.js');
      canonical = spf.net.resource.canonicalize(JS, 'foo.js');
      expect(canonical).toEqual('//test/path/bar.js');
      canonical = spf.net.resource.canonicalize(JS, 'foo.js.extra');
      expect(canonical).toEqual('//test/path/bar.js.extra');
    });

    it('files (style)', function() {
      var canonical = spf.net.resource.canonicalize(CSS, 'foo');
      expect(canonical).toEqual('//test/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'foo.css');
      expect(canonical).toEqual('//test/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'foo.css.extra');
      expect(canonical).toEqual('//test/foo.css.extra');
      // With a path.
      spf.net.resource.path(CSS, '/path/');
      canonical = spf.net.resource.canonicalize(CSS, 'foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With remapping.
      spf.net.resource.path(CSS, {
        '': 'path/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(CSS, 'foo');
      expect(canonical).toEqual('//test/path/bar.css');
      canonical = spf.net.resource.canonicalize(CSS, 'foo.css');
      expect(canonical).toEqual('//test/path/bar.css');
      canonical = spf.net.resource.canonicalize(CSS, 'foo.css.extra');
      expect(canonical).toEqual('//test/path/bar.css.extra');
    });

    it('relative paths (script)', function() {
      var canonical = spf.net.resource.canonicalize(JS, 'path/foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With a path.
      spf.net.resource.path(JS, '/path/');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo');
      expect(canonical).toEqual('//test/path/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo.js');
      expect(canonical).toEqual('//test/path/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/path/path/foo.js.extra');
      // With remapping.
      spf.net.resource.path(JS, {
        'path/': 'longpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(JS, 'path/foo');
      expect(canonical).toEqual('//test/longpath/bar.js');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo.js');
      expect(canonical).toEqual('//test/longpath/bar.js');
      canonical = spf.net.resource.canonicalize(JS, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/longpath/bar.js.extra');
    });

    it('relative paths (style)', function() {
      var canonical = spf.net.resource.canonicalize(CSS, 'path/foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With a path.
      spf.net.resource.path(CSS, '/path/');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo');
      expect(canonical).toEqual('//test/path/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo.css');
      expect(canonical).toEqual('//test/path/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/path/path/foo.css.extra');
      // With remapping.
      spf.net.resource.path(CSS, {
        'path/': 'longpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo');
      expect(canonical).toEqual('//test/longpath/bar.css');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo.css');
      expect(canonical).toEqual('//test/longpath/bar.css');
      canonical = spf.net.resource.canonicalize(CSS, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/longpath/bar.css.extra');
    });

    it('absolute paths (script)', function() {
      var canonical = spf.net.resource.canonicalize(JS, '/path/foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With a path.
      spf.net.resource.path(JS, 'http://domain');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo.js');
      expect(canonical).toEqual('http://domain/path/foo.js');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo.js.extra');
      expect(canonical).toEqual('http://domain/path/foo.js.extra');
      // With remapping.
      spf.net.resource.path(JS, {
        '/path/': 'http://domain/fullpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(JS, '/path/foo');
      expect(canonical).toEqual('http://domain/fullpath/bar.js');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo.js');
      expect(canonical).toEqual('http://domain/fullpath/bar.js');
      canonical = spf.net.resource.canonicalize(JS, '/path/foo.js.extra');
      expect(canonical).toEqual('http://domain/fullpath/bar.js.extra');
    });

    it('absolute paths (style)', function() {
      var canonical = spf.net.resource.canonicalize(CSS, '/path/foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With a path.
      spf.net.resource.path(CSS, 'http://domain');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo.css');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo.css.extra');
      expect(canonical).toEqual('http://domain/path/foo.css.extra');
      // With remapping.
      spf.net.resource.path(CSS, {
        '/path/': 'http://domain/fullpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo');
      expect(canonical).toEqual('http://domain/fullpath/bar.css');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo.css');
      expect(canonical).toEqual('http://domain/fullpath/bar.css');
      canonical = spf.net.resource.canonicalize(CSS, '/path/foo.css.extra');
      expect(canonical).toEqual('http://domain/fullpath/bar.css.extra');
    });

    it('urls (script)', function() {
      var unprotocol = '//domain/path/bar.js';
      var http = 'http://domain/path/bar.js';
      var https = 'https://domain/path/bar.js';
      var local = 'file:///user/folder/bar.js';
      var canonical = spf.net.resource.canonicalize(JS, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(JS, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(JS, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(JS, local);
      expect(canonical).toEqual(local);
      // With a path.
      spf.net.resource.path(JS, 'http://otherdomain/otherpath/');
      canonical = spf.net.resource.canonicalize(JS, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(JS, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(JS, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(JS, local);
      expect(canonical).toEqual(local);
      // With remapping.
      spf.net.resource.path(JS, {
        '/path/': 'http://otherdomain/otherpath/',
        'bar': 'foo'
      });
      canonical = spf.net.resource.canonicalize(JS, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(JS, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(JS, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(JS, local);
      expect(canonical).toEqual(local);
    });

    it('urls (style)', function() {
      var unprotocol = '//domain/path/bar.css';
      var http = 'http://domain/path/bar.css';
      var https = 'https://domain/path/bar.css';
      var local = 'file:///user/folder/bar.css';
      var canonical = spf.net.resource.canonicalize(CSS, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(CSS, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(CSS, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(CSS, local);
      expect(canonical).toEqual(local);
      // With a path.
      spf.net.resource.path(CSS, 'http://otherdomain/otherpath/');
      canonical = spf.net.resource.canonicalize(CSS, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(CSS, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(CSS, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(CSS, local);
      expect(canonical).toEqual(local);
      // With remapping.
      spf.net.resource.path(CSS, {
        '/path/': 'http://otherdomain/otherpath/',
        'bar': 'foo'
      });
      canonical = spf.net.resource.canonicalize(CSS, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(CSS, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(CSS, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(CSS, local);
      expect(canonical).toEqual(local);
    });

  });

});
