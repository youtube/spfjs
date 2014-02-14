/**
 * @fileoverview Tests for loading and unloading external resources.
 */

goog.require('spf.net.resourcebeta');


describe('spf.net.resourcebeta', function() {

  var js = spf.net.resourcebeta.Type.JS;
  var css = spf.net.resourcebeta.Type.CSS;

  beforeEach(function() {
    spf.state.values_ = {};
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
      expect(canonical).toEqual('foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('foo.js.extra');
      // With a base.
      spf.net.resourcebeta.path(js, '/base/');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo');
      expect(canonical).toEqual('/base/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js');
      expect(canonical).toEqual('/base/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'foo.js.extra');
      expect(canonical).toEqual('/base/foo.js.extra');
    });

    it('style: files', function() {
      var canonical = spf.net.resourcebeta.canonicalize(css, 'foo');
      expect(canonical).toEqual('foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('foo.css.extra');
      // With a base.
      spf.net.resourcebeta.path(css, '/base/');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo');
      expect(canonical).toEqual('/base/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css');
      expect(canonical).toEqual('/base/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'foo.css.extra');
      expect(canonical).toEqual('/base/foo.css.extra');
    });

    it('script: relative paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('path/foo.js.extra');
      // With a base.
      spf.net.resourcebeta.path(js, '/base/');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo');
      expect(canonical).toEqual('/base/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js');
      expect(canonical).toEqual('/base/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, 'path/foo.js.extra');
      expect(canonical).toEqual('/base/path/foo.js.extra');
    });

    it('style: relative paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('path/foo.css.extra');
      // With a base.
      spf.net.resourcebeta.path(css, '/base/');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo');
      expect(canonical).toEqual('/base/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css');
      expect(canonical).toEqual('/base/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, 'path/foo.css.extra');
      expect(canonical).toEqual('/base/path/foo.css.extra');
    });

    it('script: absolute paths', function() {
      var canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo');
      expect(canonical).toEqual('/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo.js');
      expect(canonical).toEqual('/path/foo.js');
      canonical = spf.net.resourcebeta.canonicalize(js, '/path/foo.js.extra');
      expect(canonical).toEqual('/path/foo.js.extra');
      // With a base.
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
      expect(canonical).toEqual('/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo.css');
      expect(canonical).toEqual('/path/foo.css');
      canonical = spf.net.resourcebeta.canonicalize(css, '/path/foo.css.extra');
      expect(canonical).toEqual('/path/foo.css.extra');
      // With a base.
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
      // With a base.
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
      // With a base.
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
