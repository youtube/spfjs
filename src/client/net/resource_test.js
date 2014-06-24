// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for loading and unloading external resources.
 */

goog.require('spf.net.resource');

goog.require('spf.url');


describe('spf.net.resource', function() {

  var js = spf.net.resource.Type.JS;
  var css = spf.net.resource.Type.CSS;
  var fakes;

  beforeEach(function() {
    spf.state.values_ = {};
    fakes = {
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
      }
    };
    spyOn(spf.url, 'absolute').andCallFake(fakes.url.absolute);
  });

  describe('prefix', function() {

    it('script: adds prefixes', function() {
      expect(spf.net.resource.prefix(js, 'foo')).toEqual('js-foo');
    });

    it('style: adds prefixes', function() {
      expect(spf.net.resource.prefix(css, 'foo')).toEqual('css-foo');
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

    it('files: script', function() {
      var canonical = spf.net.resource.canonicalize(js, 'foo');
      expect(canonical).toEqual('//test/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('//test/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('//test/foo.js.extra');
      // With a path.
      spf.net.resource.path(js, '/path/');
      canonical = spf.net.resource.canonicalize(js, 'foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With remapping.
      spf.net.resource.path(js, {
        '': 'path/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(js, 'foo');
      expect(canonical).toEqual('//test/path/bar.js');
      canonical = spf.net.resource.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('//test/path/bar.js');
      canonical = spf.net.resource.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('//test/path/bar.js.extra');
    });

    it('files: style', function() {
      var canonical = spf.net.resource.canonicalize(css, 'foo');
      expect(canonical).toEqual('//test/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('//test/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('//test/foo.css.extra');
      // With a path.
      spf.net.resource.path(css, '/path/');
      canonical = spf.net.resource.canonicalize(css, 'foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With remapping.
      spf.net.resource.path(css, {
        '': 'path/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(css, 'foo');
      expect(canonical).toEqual('//test/path/bar.css');
      canonical = spf.net.resource.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('//test/path/bar.css');
      canonical = spf.net.resource.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('//test/path/bar.css.extra');
    });

    it('relative paths: script', function() {
      var canonical = spf.net.resource.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With a path.
      spf.net.resource.path(js, '/path/');
      canonical = spf.net.resource.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('//test/path/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('//test/path/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/path/path/foo.js.extra');
      // With remapping.
      spf.net.resource.path(js, {
        'path/': 'longpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('//test/longpath/bar.js');
      canonical = spf.net.resource.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('//test/longpath/bar.js');
      canonical = spf.net.resource.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/longpath/bar.js.extra');
    });

    it('relative paths: style', function() {
      var canonical = spf.net.resource.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With a path.
      spf.net.resource.path(css, '/path/');
      canonical = spf.net.resource.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('//test/path/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('//test/path/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/path/path/foo.css.extra');
      // With remapping.
      spf.net.resource.path(css, {
        'path/': 'longpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('//test/longpath/bar.css');
      canonical = spf.net.resource.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('//test/longpath/bar.css');
      canonical = spf.net.resource.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/longpath/bar.css.extra');
    });

    it('absolute paths: script', function() {
      var canonical = spf.net.resource.canonicalize(js, '/path/foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, '/path/foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, '/path/foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With a path.
      spf.net.resource.path(js, 'http://domain');
      canonical = spf.net.resource.canonicalize(js, '/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, '/path/foo.js');
      expect(canonical).toEqual('http://domain/path/foo.js');
      canonical = spf.net.resource.canonicalize(js, '/path/foo.js.extra');
      expect(canonical).toEqual('http://domain/path/foo.js.extra');
      // With remapping.
      spf.net.resource.path(js, {
        '/path/': 'http://domain/fullpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(js, '/path/foo');
      expect(canonical).toEqual('http://domain/fullpath/bar.js');
      canonical = spf.net.resource.canonicalize(js, '/path/foo.js');
      expect(canonical).toEqual('http://domain/fullpath/bar.js');
      canonical = spf.net.resource.canonicalize(js, '/path/foo.js.extra');
      expect(canonical).toEqual('http://domain/fullpath/bar.js.extra');
    });

    it('absolute paths: style', function() {
      var canonical = spf.net.resource.canonicalize(css, '/path/foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, '/path/foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, '/path/foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With a path.
      spf.net.resource.path(css, 'http://domain');
      canonical = spf.net.resource.canonicalize(css, '/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, '/path/foo.css');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.resource.canonicalize(css, '/path/foo.css.extra');
      expect(canonical).toEqual('http://domain/path/foo.css.extra');
      // With remapping.
      spf.net.resource.path(css, {
        '/path/': 'http://domain/fullpath/',
        'foo': 'bar'
      });
      canonical = spf.net.resource.canonicalize(css, '/path/foo');
      expect(canonical).toEqual('http://domain/fullpath/bar.css');
      canonical = spf.net.resource.canonicalize(css, '/path/foo.css');
      expect(canonical).toEqual('http://domain/fullpath/bar.css');
      canonical = spf.net.resource.canonicalize(css, '/path/foo.css.extra');
      expect(canonical).toEqual('http://domain/fullpath/bar.css.extra');
    });

    it('urls: script', function() {
      var unprotocol = '//domain/path/bar.js';
      var http = 'http://domain/path/bar.js';
      var https = 'https://domain/path/bar.js';
      var local = 'file:///user/folder/bar.js';
      var canonical = spf.net.resource.canonicalize(js, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(js, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(js, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(js, local);
      expect(canonical).toEqual(local);
      // With a path.
      spf.net.resource.path(js, 'http://otherdomain/otherpath/');
      canonical = spf.net.resource.canonicalize(js, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(js, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(js, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(js, local);
      expect(canonical).toEqual(local);
      // With remapping.
      spf.net.resource.path(js, {
        '/path/': 'http://otherdomain/otherpath/',
        'bar': 'foo'
      });
      canonical = spf.net.resource.canonicalize(js, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(js, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(js, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(js, local);
      expect(canonical).toEqual(local);
    });

    it('urls: style', function() {
      var unprotocol = '//domain/path/bar.css';
      var http = 'http://domain/path/bar.css';
      var https = 'https://domain/path/bar.css';
      var local = 'file:///user/folder/bar.css';
      var canonical = spf.net.resource.canonicalize(css, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(css, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(css, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(css, local);
      expect(canonical).toEqual(local);
      // With a path.
      spf.net.resource.path(css, 'http://otherdomain/otherpath/');
      canonical = spf.net.resource.canonicalize(css, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(css, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(css, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(css, local);
      expect(canonical).toEqual(local);
      // With remapping.
      spf.net.resource.path(css, {
        '/path/': 'http://otherdomain/otherpath/',
        'bar': 'foo'
      });
      canonical = spf.net.resource.canonicalize(css, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resource.canonicalize(css, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resource.canonicalize(css, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resource.canonicalize(css, local);
      expect(canonical).toEqual(local);
    });

  });

});
