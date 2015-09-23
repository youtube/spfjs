// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for loading and unloading external resources.
 */

goog.require('spf');
goog.require('spf.array');
goog.require('spf.dom');
goog.require('spf.net.resource');
goog.require('spf.net.resource.name');
goog.require('spf.net.resource.status');
goog.require('spf.net.resource.url');
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
    dom: {
      query: spf.dom.query
    },
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
    dom: {
      query: function(selector, opt_document) {
        return reals.dom.query(selector, fakes.doc);
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
      create: function(type, url, opt_callback, opt_document,
          opt_statusGroup, opt_prevUrl) {
        var el = reals.resource.create(type, url, opt_callback, fakes.doc,
            undefined, opt_prevUrl);
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
    this.firstChild = null;
  };
  FakeElement.prototype.getAttribute = function(name) {
    return this.attributes[name];
  };
  FakeElement.prototype.setAttribute = function(name, value) {
    this.attributes[name] = value;
  };
  FakeElement.prototype.insertBefore = function(el, ref) {
    if (ref === null) {
      // ref is null when attempting to insert an element before another
      // element's firstChild (see the constructor above). Prepend if so.
      // TODO(rviscomi): Clean up by implementing a FakeElement firstChild.
      return nodes.unshift(el);
    } else if (!ref) {
      // Browsers append when no ref is provided.
      return nodes.push(el);
    }
    // When ref is an element, insert the new element before it.
    var idx = spf.array.indexOf(nodes, ref);
    if (idx != -1) {
      nodes.splice(idx, 0, el);
    }
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
    jasmine.clock().install();

    spf.state.values_ = {};
    spf.pubsub.subscriptions = {};
    spf.net.resource.name_ = {};
    spf.net.resource.url_ = {};
    spf.net.resource.status_ = {};

    nodes = [new FakeElement('head')];
    callbacks = {
      one: jasmine.createSpy('one'),
      two: jasmine.createSpy('two'),
      three: jasmine.createSpy('three'),
      four: jasmine.createSpy('four')
    };

    spyOn(spf, 'dispatch');
    spyOn(spf.dom, 'query').and.callFake(fakes.dom.query);
    spyOn(spf.url, 'absolute').and.callFake(fakes.url.absolute);
    spyOn(spf.net.resource, 'create').and.callFake(fakes.resource.create);
    spyOn(spf.net.resource, 'destroy').and.callFake(fakes.resource.destroy);
  });


  afterEach(function() {
    jasmine.clock().uninstall();
  });


  describe('load', function() {

    it('loads with no name (script)', function() {
      // Calling load without a name isn't officially supported.
      // Ensure that it still works if someone does.
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
    });

    it('loads with no name (style)', function() {
      // Calling load without a name isn't officially supported.
      // Ensure that it still works if someone does.
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
    });

    it('executes callbacks with no name (script)', function() {
      // Calling load without a name isn't officially supported, but ensure
      // that it still works if someone does.
      var url = 'url-a.js';
      var name = undefined;
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name, callbacks.one);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(1);
    });

    it('executes callbacks with no name (style)', function() {
      // Calling load without a name isn't officially supported, but ensure
      // that it still works if someone does.
      var url = 'url-a.css';
      var name = undefined;
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name, callbacks.one);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(1);
    });

    it('does not reload url with no name (script)', function() {
      // Calling load without a name isn't officially supported, but ensure
      // that it still works if someone does.
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      var el = getScriptEls()[0];
      spf.net.resource.load(JS, url);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(JS, url);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0]).toBe(el);
    });

    it('does not reload url with no name (style)', function() {
      // Calling load without a name isn't officially supported, but ensure
      // that it still works if someone does.
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      var el = getStyleEls()[0];
      spf.net.resource.load(CSS, url);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(CSS, url);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0]).toBe(el);
    });

    it('executes repeat callbacks for url with no name (script)', function() {
      // Calling load without a name isn't officially supported, but ensure
      // that it still works if someone does.
      var url = 'url-a.js';
      var name = undefined;
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, url, name, callbacks.two);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(1);
      expect(callbacks.two.calls.count()).toEqual(1);
      // Repeated calls should execute callbacks again.
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, url, name, callbacks.two);
      expect(callbacks.one.calls.count()).toEqual(2);
      expect(callbacks.two.calls.count()).toEqual(2);
    });

    it('executes repeat callbacks for url with no name (style)', function() {
      // Calling load without a name isn't officially supported, but ensure
      // that it still works if someone does.
      var url = 'url-a.css';
      var name = undefined;
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, url, name, callbacks.two);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(1);
      expect(callbacks.two.calls.count()).toEqual(1);
      // Repeated calls should execute callbacks again.
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, url, name, callbacks.two);
      expect(callbacks.one.calls.count()).toEqual(2);
      expect(callbacks.two.calls.count()).toEqual(2);
    });

    it('loads (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(name);
    });

    it('loads (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(name);
    });

    it('executes callbacks (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name, callbacks.one);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(1);
    });

    it('executes callbacks (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name, callbacks.one);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(1);
    });

    it('does not reload url for same name after loaded (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(name);
      var el = getScriptEls()[0];
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(name);
      expect(getScriptEls()[0]).toBe(el);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('does not reload url for same name after loaded (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(name);
      var el = getStyleEls()[0];
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(name);
      expect(getStyleEls()[0]).toBe(el);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('does not reload url for same name while loading (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name);
      expect(getScriptEls().length).toEqual(1);
      var el = getScriptEls()[0];
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(name);
      expect(getScriptEls()[0]).toBe(el);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('does not reload url for same name while loading (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name);
      expect(getStyleEls().length).toEqual(1);
      var el = getStyleEls()[0];
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(name);
      expect(getStyleEls()[0]).toBe(el);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('executes repeat callbacks after loaded (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, url, name, callbacks.one);
      expect(callbacks.one.calls.count()).toEqual(2);
    });

    it('executes repeat callbacks after loaded (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, url, name, callbacks.one);
      expect(callbacks.one.calls.count()).toEqual(2);
    });

    it('executes repeat callbacks while loading (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, url, name, callbacks.two);
      spf.net.resource.load(JS, url, name, callbacks.two);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(2);
      expect(callbacks.two.calls.count()).toEqual(2);
      // Repeated calls should execute callbacks again.
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, url, name, callbacks.two);
      expect(callbacks.one.calls.count()).toEqual(3);
      expect(callbacks.two.calls.count()).toEqual(3);
    });

    it('executes repeat callbacks while loading (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, url, name, callbacks.two);
      spf.net.resource.load(CSS, url, name, callbacks.two);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(2);
      expect(callbacks.two.calls.count()).toEqual(2);
      // Repeated calls should execute callbacks again.
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, url, name, callbacks.two);
      expect(callbacks.one.calls.count()).toEqual(3);
      expect(callbacks.two.calls.count()).toEqual(3);
    });

    it('switches to new url for same name after loaded (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      var newCanonical = spf.net.resource.canonicalize(JS, newUrl);
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(JS, newUrl, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(newCanonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(name);
      expect(spf.net.resource.url.get(JS, name)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(JS, newCanonical)).toEqual(name);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(JS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new url for same name after loaded (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl);
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(CSS, newUrl, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(newCanonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(name);
      expect(spf.net.resource.url.get(CSS, name)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(CSS, newCanonical)).toEqual(name);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(CSS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new url for same name while loading (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      var newCanonical = spf.net.resource.canonicalize(JS, newUrl);
      spf.net.resource.load(JS, url, name);
      spf.net.resource.load(JS, newUrl, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(newCanonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(name);
      expect(spf.net.resource.url.get(JS, name)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(JS, newCanonical)).toEqual(name);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(JS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new url for same name while loading (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl);
      spf.net.resource.load(CSS, url, name);
      spf.net.resource.load(CSS, newUrl, name);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(newCanonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(name);
      expect(spf.net.resource.url.get(CSS, name)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(CSS, newCanonical)).toEqual(name);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(CSS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
    });

    it('cancels previous callbacks when ' +
       'switches to new url for same name while loading (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      spf.net.resource.load(JS, url, name, callbacks.one);
      spf.net.resource.load(JS, newUrl, name, callbacks.two);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(1);
    });

    it('cancels previous callbacks when ' +
       'switches to new url for same name while loading (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      spf.net.resource.load(CSS, url, name, callbacks.one);
      spf.net.resource.load(CSS, newUrl, name, callbacks.two);
      jasmine.clock().tick(1); // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(1);
    });

    it('switches to new name for same url after loaded (script)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(JS, url, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(JS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(JS, newName)).toEqual(canonical);
      expect(spf.net.resource.name.get(JS, canonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(true);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('switches to new name for same url after loaded (style)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      spf.net.resource.load(CSS, url, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(CSS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(CSS, newName)).toEqual(canonical);
      expect(spf.net.resource.name.get(CSS, canonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(true);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('switches to new name for same url while loading (script)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      spf.net.resource.load(JS, url, name);
      spf.net.resource.load(JS, url, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(canonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(JS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(JS, newName)).toEqual(canonical);
      expect(spf.net.resource.name.get(JS, canonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(true);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('switches to new name for same url while loading (style)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      spf.net.resource.load(CSS, url, name);
      spf.net.resource.load(CSS, url, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(canonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(CSS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(CSS, newName)).toEqual(canonical);
      expect(spf.net.resource.name.get(CSS, canonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(true);
      expect(spf.dispatch).not.toHaveBeenCalled();
    });

    it('switches to new url for same name, then ' +
       'switches to new name for same url after loaded (script)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      var newCanonical = spf.net.resource.canonicalize(JS, newUrl);
      // Load.
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new url for same name.
      spf.net.resource.load(JS, newUrl, name);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new name for same url.
      spf.net.resource.load(JS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(newCanonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(JS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(JS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(JS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(JS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(JS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new url for same name, then ' +
       'switches to new name for same url after loaded (style)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl);
      // Load.
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new url for same name.
      spf.net.resource.load(CSS, newUrl, name);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new name for same url.
      spf.net.resource.load(CSS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(newCanonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(CSS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(CSS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(CSS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(CSS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(CSS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new url for same name, then ' +
       'switches to new name for same url while loading (script)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      var newCanonical = spf.net.resource.canonicalize(JS, newUrl);
      // Load.
      spf.net.resource.load(JS, url, name);
      // Switch to new url for same name.
      spf.net.resource.load(JS, newUrl, name);
      // Switch to new name for same url.
      spf.net.resource.load(JS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(newCanonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(JS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(JS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(JS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(JS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(JS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new url for same name, then ' +
       'switches to new name for same url while loading (style)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl);
      // Load.
      spf.net.resource.load(CSS, url, name);
      // Switch to new url for same name.
      spf.net.resource.load(CSS, newUrl, name);
      // Switch to new name for same url.
      spf.net.resource.load(CSS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(newCanonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(CSS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(CSS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(CSS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(CSS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(CSS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_BEFORE_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
    });

    it('switches to new name for same url, then ' +
       'switches to new url for same name after loaded (script)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      var newCanonical = spf.net.resource.canonicalize(JS, newUrl);
      // Load.
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new name for same url.
      spf.net.resource.load(JS, url, newName);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new url for same name.
      spf.net.resource.load(JS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(newCanonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(JS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(JS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(JS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(JS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(JS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_BEFORE_UNLOAD,
          {name: newName, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: newName, url: canonical});
    });

    it('switches to new name for same url, then ' +
       'switches to new url for same name after loaded (style)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl);
      // Load.
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new name for same url.
      spf.net.resource.load(CSS, url, newName);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new url for same name.
      spf.net.resource.load(CSS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(newCanonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(CSS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(CSS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(CSS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(CSS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(CSS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_BEFORE_UNLOAD,
          {name: newName, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: newName, url: canonical});
    });

    it('switches to new name for same url, then ' +
       'switches to new url for same name while loading (script)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.js';
      var newUrl = 'url-b.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      var newCanonical = spf.net.resource.canonicalize(JS, newUrl);
      // Load.
      spf.net.resource.load(JS, url, name);
      // Switch to new name for same url.
      spf.net.resource.load(JS, url, newName);
      // Switch to new url for same name.
      spf.net.resource.load(JS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getScriptEls().length).toEqual(1);
      expect(getScriptEls()[0].src).toEqual(newCanonical);
      expect(getScriptEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(JS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(JS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(JS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(JS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(JS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(JS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_BEFORE_UNLOAD,
          {name: newName, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: newName, url: canonical});
    });

    it('switches to new name for same url, then ' +
       'switches to new url for same name while loading (style)', function() {
      var name = 'a';
      var newName = 'b';
      var url = 'url-a.css';
      var newUrl = 'url-b.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl);
      // Load.
      spf.net.resource.load(CSS, url, name);
      // Switch to new name for same url.
      spf.net.resource.load(CSS, url, newName);
      // Switch to new url for same name.
      spf.net.resource.load(CSS, newUrl, newName);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(1);
      expect(getStyleEls()[0].href).toEqual(newCanonical);
      expect(getStyleEls()[0].getAttribute('name')).toEqual(newName);
      expect(spf.net.resource.url.get(CSS, name)).toBe(undefined);
      expect(spf.net.resource.url.get(CSS, newName)).toEqual(newCanonical);
      expect(spf.net.resource.name.get(CSS, canonical)).toEqual(undefined);
      expect(spf.net.resource.name.get(CSS, newCanonical)).toEqual(newName);
      expect(spf.net.resource.status.loaded(CSS, canonical)).toBe(false);
      expect(spf.net.resource.status.loaded(CSS, newCanonical)).toBe(true);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_BEFORE_UNLOAD,
          {name: newName, url: canonical});
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: newName, url: canonical});
    });

    it('switches to new url in-place ' +
       'for same name after loaded (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var name2 = 'b';
      var url2 = 'url-b.css';
      var newUrl2 = 'url-b2.css';
      var name3 = 'c';
      var url3 = 'url-c.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      var newCanonical = spf.net.resource.canonicalize(CSS, newUrl2);
      // Load.
      spf.net.resource.load(CSS, url, name);
      spf.net.resource.load(CSS, url2, name2);
      spf.net.resource.load(CSS, url3, name3);
      jasmine.clock().tick(1); // Finish loading.
      // Switch to new url for same name.
      spf.net.resource.load(CSS, newUrl2, name2);
      jasmine.clock().tick(1); // Finish loading.
      expect(getStyleEls().length).toEqual(3);
      expect(getStyleEls()[1].href).toEqual(newCanonical);
      expect(getStyleEls()[1].getAttribute('name')).toEqual(name2);
    });

  });


  describe('unload', function() {

    it('unloads after loaded (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      // Load a URL.
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1);  // Finish loading.
      expect(getScriptUrls()).toContain(canonical);
      // Unload it.
      spf.net.resource.unload(JS, name);
      expect(spf.net.resource.status.get(JS, canonical)).toBe(undefined);
      expect(getScriptUrls()).not.toContain(canonical);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
    });

    it('unloads after loaded (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      // Load a URL.
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1);  // Finish loading.
      expect(getStyleUrls()).toContain(canonical);
      // Unload it.
      spf.net.resource.unload(CSS, 'a');
      expect(spf.net.resource.status.get(CSS, canonical)).toBe(undefined);
      expect(getStyleUrls()).not.toContain(canonical);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
    });

    it('unloads while loading (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      // Load a URL.
      spf.net.resource.load(JS, url, name);
      // Unload it.
      spf.net.resource.unload(JS, name);
      expect(spf.net.resource.status.get(JS, canonical)).toBe(undefined);
      expect(getScriptUrls()).not.toContain(canonical);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
    });

    it('unloads while loading (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      // Load a URL.
      spf.net.resource.load(CSS, url, name);
      // Unload it.
      spf.net.resource.unload(CSS, name);
      expect('//test/url-a.css' in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain(canonical);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
    });

    it('does nothing for repeated calls (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      // Calls before loading should be no-ops.
      var unload = spf.bind(spf.net.resource.unload, null, JS, name);
      expect(unload).not.toThrow();
      // Load a URL.
      spf.net.resource.load(JS, url, name);
      jasmine.clock().tick(1);
      // Unload it.
      spf.net.resource.unload(JS, name);
      spf.net.resource.unload(JS, name);
      expect(canonical in spf.net.resource.status_).toBe(false);
      expect(getScriptUrls()).not.toContain(canonical);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.JS_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch.calls.count()).toEqual(1);
      // Repated calls should be no-ops.
      spf.net.resource.unload(JS, name);
      spf.net.resource.unload(JS, name);
      spf.net.resource.unload(JS, name);
      expect(canonical in spf.net.resource.status_).toBe(false);
      expect(getScriptUrls()).not.toContain(canonical);
      expect(spf.dispatch.calls.count()).toEqual(1);
    });

    it('does nothing for repeated calls (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      // Calls before loading should be no-ops.
      var unload = spf.bind(spf.net.resource.unload, null, CSS, name);
      expect(unload).not.toThrow();
      // Load a URL.
      spf.net.resource.load(CSS, url, name);
      jasmine.clock().tick(1);
      // Unload it.
      spf.net.resource.unload(CSS, name);
      spf.net.resource.unload(CSS, name);
      expect(canonical in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain(canonical);
      expect(spf.dispatch).toHaveBeenCalledWith(
          spf.EventName.CSS_UNLOAD,
          {name: name, url: canonical});
      expect(spf.dispatch.calls.count()).toEqual(1);
      // Repated calls should be no-ops.
      spf.net.resource.unload(CSS, name);
      spf.net.resource.unload(CSS, name);
      spf.net.resource.unload(CSS, name);
      expect(canonical in spf.net.resource.status_).toBe(false);
      expect(getStyleUrls()).not.toContain(canonical);
      expect(spf.dispatch.calls.count()).toEqual(1);
    });

    it('cancels previous callbacks while loading (script)', function() {
      var name = 'a';
      var url = 'url-a.js';
      var canonical = spf.net.resource.canonicalize(JS, url);
      // Load a URL.
      spf.net.resource.load(JS, url, name, callbacks.one);
      // Unload it.
      spf.net.resource.unload(JS, name);
      expect(callbacks.one.calls.count()).toEqual(0);
      // Load it again with a differnt callback.
      spf.net.resource.load(JS, url, name, callbacks.two);
      jasmine.clock().tick(1);  // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(1);
    });

    it('cancels previous callbacks while loading (style)', function() {
      var name = 'a';
      var url = 'url-a.css';
      var canonical = spf.net.resource.canonicalize(CSS, url);
      // Load a URL.
      spf.net.resource.load(CSS, url, name, callbacks.one);
      // Unload it.
      spf.net.resource.unload(CSS, name);
      expect(callbacks.one.calls.count()).toEqual(0);
      // Load it again with a differnt callback.
      spf.net.resource.load(CSS, url, name, callbacks.two);
      jasmine.clock().tick(1);  // Finish loading.
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(1);
    });

  });


  describe('create', function() {

    it('prepends nodes to avoid execution errors (script)', function() {
      spf.net.resource.create(JS, 'url-a.js');
      spf.net.resource.create(JS, 'url-b.js');
      jasmine.clock().tick(1);
      expect(getScriptEls().length).toEqual(2);
      expect(getScriptEls()[0].src).toEqual('//test/url-b.js');
      expect(getScriptEls()[1].src).toEqual('//test/url-a.js');
    });

    it('appends nodes to preserve order (style)', function() {
      spf.net.resource.load(CSS, 'url-a.css');
      spf.net.resource.load(CSS, 'url-b.css');
      jasmine.clock().tick(1);
      expect(getStyleEls().length).toEqual(2);
      expect(getStyleEls()[0].href).toEqual('//test/url-a.css');
      expect(getStyleEls()[1].href).toEqual('//test/url-b.css');
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
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // Not loaded.
      spf.net.resource.url.set(JS, 'foo', '//test/f.js');
      spf.net.resource.url.set(JS, 'bar', '//test/b.js');
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // Some loading.
      spf.net.resource.status.set(LOADING, JS, '//test/b.js');
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // All loading.
      spf.net.resource.status.set(LOADING, JS, '//test/b.js');
      spf.net.resource.status.set(LOADING, JS, '//test/f.js');
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // Some loaded, some loading.
      spf.net.resource.status.set(LOADED, JS, '//test/b.js');
      spf.net.resource.status.set(LOADING, JS, '//test/f.js');
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(1);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // All loaded.
      spf.net.resource.status.set(LOADED, JS, '//test/b.js');
      spf.net.resource.status.set(LOADED, JS, '//test/f.js');
      spf.net.resource.check(JS);
      expect(callbacks.one.calls.count()).toEqual(1);
      expect(callbacks.two.calls.count()).toEqual(1);
      expect(callbacks.three.calls.count()).toEqual(1);
      expect(callbacks.four.calls.count()).toEqual(0);
    });

    it('executes pending callbacks (style)', function() {
      // No dependencies.
      spf.pubsub.subscribe('css-foo', callbacks.one);
      spf.pubsub.subscribe('css-bar', callbacks.two);
      spf.pubsub.subscribe('css-foo|bar', callbacks.three);
      spf.pubsub.subscribe('css-other', callbacks.four);
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // Not loaded.
      spf.net.resource.url.set(CSS, 'foo', '//test/f.css');
      spf.net.resource.url.set(CSS, 'bar', '//test/b.css');
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // Some loading.
      spf.net.resource.status.set(LOADING, CSS, '//test/b.css');
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // All loading.
      spf.net.resource.status.set(LOADING, CSS, '//test/b.css');
      spf.net.resource.status.set(LOADING, CSS, '//test/f.css');
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(0);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // Some loaded, some loading.
      spf.net.resource.status.set(LOADED, CSS, '//test/b.css');
      spf.net.resource.status.set(LOADING, CSS, '//test/f.css');
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.count()).toEqual(0);
      expect(callbacks.two.calls.count()).toEqual(1);
      expect(callbacks.three.calls.count()).toEqual(0);
      expect(callbacks.four.calls.count()).toEqual(0);
      // All loaded.
      spf.net.resource.status.set(LOADED, CSS, '//test/b.css');
      spf.net.resource.status.set(LOADED, CSS, '//test/f.css');
      spf.net.resource.check(CSS);
      expect(callbacks.one.calls.count()).toEqual(1);
      expect(callbacks.two.calls.count()).toEqual(1);
      expect(callbacks.three.calls.count()).toEqual(1);
      expect(callbacks.four.calls.count()).toEqual(0);
    });

  });


  describe('key', function() {

    it('builds full key (script)', function() {
      expect(spf.net.resource.key(JS, 'foo')).toEqual('js-foo');
    });

    it('builds full key (sytle)', function() {
      expect(spf.net.resource.key(CSS, 'foo')).toEqual('css-foo');
    });

    it('skips falsy labels', function() {
      expect(spf.net.resource.key(JS, 'foo', null)).toEqual('js-foo');
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
