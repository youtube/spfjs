/**
 * @fileoverview Tests for loading and unloading external resources.
 */

goog.require('spf.net.resourcebeta');

goog.require('spf.url');


describe('spf.net.resourcebeta', function() {

  var js = spf.net.resourcebeta.Type.JS;
  var css = spf.net.resourcebeta.Type.CSS;
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
      expect(spf.net.resourcebeta.prefix(js, 'foo')).toEqual('js-foo');
    });

    it('style: adds prefixes', function() {
      expect(spf.net.resourcebeta.prefix(css, 'foo')).toEqual('css-foo');
    });

  });

  describe('label', function() {

    it('removes special characters', function() {
      var name = spf.net.resourcebeta.label('foo~!@#$%^&');
      expect(name).toEqual('foo');
      name = spf.net.resourcebeta.label('*+-=()[]{}|foo');
      expect(name).toEqual('foo');
      name = spf.net.resourcebeta.label('`\\;:"foo,./<>?');
      expect(name).toEqual('foo');
      name = spf.net.resourcebeta.label('foo\uD83D\uDCA9');
      expect(name).toEqual('foo');
    });

  });

  describe('canonicalize', function() {

    it('script: files', function() {
      var canonical = spf.net.resourcebeta.canonicalize(js, 'foo');
      expect(canonical).toEqual('//test/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('//test/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('//test/foo.js.extra');
      // With a path.
      spf.net.resourcebeta.path(js, '/path/');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
    });

    it('style: files', function() {
      var canonical = spf.net.resourcebeta.canonicalize(css, 'foo');
      expect(canonical).toEqual('//test/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('//test/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('//test/foo.css.extra');
      // With a path.
      spf.net.resourcebeta.path(css, '/path/');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
    });

    it('script: relative paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With a path.
      spf.net.resourcebeta.path(js, '/path/');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('//test/path/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('//test/path/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('//test/path/path/foo.js.extra');
    });

    it('style: relative paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With a path.
      spf.net.resourcebeta.path(css, '/path/');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('//test/path/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('//test/path/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('//test/path/path/foo.css.extra');
    });

    it('script: absolute paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo.js');
      expect(canonical).toEqual('//test/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo.js.extra');
      expect(canonical).toEqual('//test/path/foo.js.extra');
      // With a path.
      spf.net.resourcebeta.path(js, 'http://domain');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo.js');
      expect(canonical).toEqual('http://domain/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo.js.extra');
      expect(canonical).toEqual('http://domain/path/foo.js.extra');
    });

    it('style: absolute paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo.css');
      expect(canonical).toEqual('//test/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo.css.extra');
      expect(canonical).toEqual('//test/path/foo.css.extra');
      // With a path.
      spf.net.resourcebeta.path(css, 'http://domain');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo.css');
      expect(canonical).toEqual('http://domain/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo.css.extra');
      expect(canonical).toEqual('http://domain/path/foo.css.extra');
    });

    it('script: urls', function() {
      var unprotocol = '//domain/path/bar.js';
      var http = 'http://domain/path/bar.js';
      var https = 'https://domain/path/bar.js';
      var local = 'file:///user/folder/bar.js';
      var canonical = spf.net.resourcebeta.canonicalize(js, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resourcebeta.canonicalize(js, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resourcebeta.canonicalize(js, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resourcebeta.canonicalize(js, local);
      expect(canonical).toEqual(local);
      // With a path.
      spf.net.resourcebeta.path(js, 'http://otherdomain/otherpath/');
      canonical = spf.net.resourcebeta.canonicalize(js, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resourcebeta.canonicalize(js, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resourcebeta.canonicalize(js, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resourcebeta.canonicalize(js, local);
      expect(canonical).toEqual(local);
    });

    it('style: urls', function() {
      var unprotocol = '//domain/path/bar.css';
      var http = 'http://domain/path/bar.css';
      var https = 'https://domain/path/bar.css';
      var local = 'file:///user/folder/bar.css';
      var canonical = spf.net.resourcebeta.canonicalize(css, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resourcebeta.canonicalize(css, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resourcebeta.canonicalize(css, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resourcebeta.canonicalize(css, local);
      expect(canonical).toEqual(local);
      // With a path.
      spf.net.resourcebeta.path(css, 'http://otherdomain/otherpath/');
      canonical = spf.net.resourcebeta.canonicalize(css, unprotocol);
      expect(canonical).toEqual(unprotocol);
      canonical = spf.net.resourcebeta.canonicalize(css, http);
      expect(canonical).toEqual(http);
      canonical = spf.net.resourcebeta.canonicalize(css, https);
      expect(canonical).toEqual(https);
      canonical = spf.net.resourcebeta.canonicalize(css, local);
      expect(canonical).toEqual(local);
    });

  });

});
