// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for URL manipulation functions.
 */

goog.require('spf.config');
goog.require('spf.url');


describe('spf.url', function() {

  afterEach(function() {
    spf.config.clear();
  });


  describe('identify', function() {

    it('handles no identifier', function() {
      spf.config.set('url-identifier', null);
      var url = '/page';
      expect(spf.url.identify(url)).toEqual('/page');
      expect(spf.url.identify(url, 'test')).toEqual('/page');
    });

    it('appends a static identifier directly', function() {
      spf.config.set('url-identifier', '.spf.json');
      var url = '/page.html';
      expect(spf.url.identify(url)).toEqual('/page.html.spf.json');
      expect(spf.url.identify(url, 'test')).toEqual('/page.html.spf.json');
    });

    it('appends dynamic identifier as a parameter', function() {
      spf.config.set('url-identifier', '?spf=__type__');
      var url = '/page';
      expect(spf.url.identify(url)).toEqual('/page?spf=');
      expect(spf.url.identify(url, 'test')).toEqual('/page?spf=test');
      url = '/page?arg=1';
      expect(spf.url.identify(url)).toEqual('/page?arg=1&spf=');
      expect(spf.url.identify(url, 'test')).toEqual('/page?arg=1&spf=test');
    });

  });

  describe('appendParameters', function() {

    it('ignores an empty object', function() {
      var url = '/page';
      expect(spf.url.appendParameters(url, {})).toEqual('/page');
    });

    it('uses the correct delimeter', function() {
      var url = '/page';
      var args = {'arg': 1};
      expect(spf.url.appendParameters(url, args)).toEqual('/page?arg=1');
      var url = '/page?old=1';
      expect(spf.url.appendParameters(url, args)).toEqual('/page?old=1&arg=1');
    });

    it('respects hashes', function() {
      var url = '/page#part';
      var args = {'arg': 1};
      expect(spf.url.appendParameters(url, args)).toEqual('/page?arg=1#part');
    });

  });

  describe('removeParameters', function() {

    it('does not change a URL without the parameter', function() {
      var url = '/page';
      expect(spf.url.removeParameters(url, ['param'])).toEqual('/page');
    });

    it('removes the parameter', function() {
      var url = '/page?param=abc';
      expect(spf.url.removeParameters(url, ['param'])).toEqual('/page');
    });

    it('removes the parameter without a value', function() {
      var url = '/page?param';
      expect(spf.url.removeParameters(url, ['param'])).toEqual('/page');
    });

    it('does not affect other parameters', function() {
      var url = '/page?param1=123&param=abc&param3=def';
      expect(spf.url.removeParameters(url, ['param'])).toEqual(
          '/page?param1=123&param3=def');
    });

    it('respects hashes', function() {
      var url = '/page?param=123#frag';
      expect(spf.url.removeParameters(url, ['param'])).toEqual('/page#frag');

      url = '/page?param=123#frag&param=abc';
      expect(spf.url.removeParameters(url, ['param'])).toEqual(
          '/page#frag&param=abc');
    });

    it('removes multiple instances', function() {
      var url = '/page?param=123&next=4&param=5';
      expect(spf.url.removeParameters(url, ['param'])).toEqual('/page?&next=4');
    });

  });

  describe('unprotocol', function() {

    it('absolute', function() {
      // HTTP.
      var url = 'http://domain/path/';
      expect(spf.url.unprotocol(url)).toEqual('//domain/path/');
      // HTTP with extra slashes in path.
      url = 'http://domain//path/';
      expect(spf.url.unprotocol(url)).toEqual('//domain//path/');
      // HTTPS.
      url = 'https://domain/path/';
      expect(spf.url.unprotocol(url)).toEqual('//domain/path/');
      // HTTPS with .. path component.
      url = 'https://domain/path/../';
      expect(spf.url.unprotocol(url)).toEqual('//domain/path/../');
      // Local files.
      url = 'file://domain/path/';
      expect(spf.url.unprotocol(url)).toEqual('//domain/path/');
      // Future-proofing.
      url = 'unknown://domain/path/';
      expect(spf.url.unprotocol(url)).toEqual('//domain/path/');
      // Don't touch weird things.
      url = 'malformed:path////file';
      expect(spf.url.unprotocol(url)).toEqual('malformed:path////file');
      // Still don't touch weird things.
      url = 'path/a/http://domain/path/b/';
      expect(spf.url.unprotocol(url)).toEqual('path/a/http://domain/path/b/');
    });

    it('protocol-relative', function() {
      var url = '//domain/path/file.ext';
      expect(spf.url.unprotocol(url)).toEqual('//domain/path/file.ext');
    });

    it('document-relative', function() {
      var url = '/path/file.ext';
      expect(spf.url.unprotocol(url)).toEqual('/path/file.ext');
    });

  });


  describe('unhash', function() {

    it('no hash', function() {
      var url = '/page';
      expect(spf.url.unhash(url)).toEqual('/page');
    });

    it('empty hash', function() {
      var url = '/page#';
      expect(spf.url.unhash(url)).toEqual('/page');
    });

    it('hash', function() {
      var url = '/page#frag';
      expect(spf.url.unhash(url)).toEqual('/page');
    });

  });


  describe('path', function() {

    it('no path', function() {
      var url = 'http://www.website.com';
      expect(spf.url.path(url)).toEqual('/');
    });

    it('path', function() {
      var url = 'http://www.website.com/path';
      expect(spf.url.path(url)).toEqual('/path');
    });

    it('path with parameters', function() {
      var url = 'http://www.website.com/path?param=value';
      expect(spf.url.path(url)).toEqual('/path');
    });

    it('path with hash', function() {
      var url = 'http://www.website.com/path#state';
      expect(spf.url.path(url)).toEqual('/path');
    });

  });


});
