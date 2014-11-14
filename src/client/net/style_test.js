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

  var CSS = spf.net.resource.Type.CSS;

  beforeEach(function() {
    spyOn(spf.net.resource, 'load');
    spyOn(spf.net.resource, 'unload');
    spyOn(spf.net.resource, 'create');
    spyOn(spf.net.resource, 'prefetch');
  });


  describe('load', function() {

    it('passes a url with name', function() {
      var url = 'url-a.css';
      var name = 'a';
      var fn = undefined;
      spf.net.style.load(url, name);
      expect(spf.net.resource.load).toHaveBeenCalledWith(CSS, url, name, fn);
    });

    it('passes a url with name and callback', function() {
      var url = 'url-a.css';
      var name = 'a';
      var fn = function() {};
      spf.net.style.load(url, name, fn);
      expect(spf.net.resource.load).toHaveBeenCalledWith(CSS, url, name, fn);
    });

  });


  describe('unload', function() {

    it('passes name', function() {
      var name = 'a';
      spf.net.style.unload(name);
      expect(spf.net.resource.unload).toHaveBeenCalledWith(CSS, name);
    });

  });


  describe('get', function() {

    it('passes url', function() {
      var url = 'url-a.css';
      var fn = undefined;
      spf.net.style.get(url);
      expect(spf.net.resource.create).toHaveBeenCalledWith(CSS, url, fn);
    });

    it('passes url with function', function() {
      var url = 'url-a.css';
      var fn = function() {};
      spf.net.style.get(url, fn);
      expect(spf.net.resource.create).toHaveBeenCalledWith(CSS, url, fn);
    });

  });


  describe('prefetch', function() {

    it('calls for a single url', function() {
      var url = 'url-a.css';
      spf.net.style.prefetch(url);
      expect(spf.net.resource.prefetch).toHaveBeenCalledWith(CSS, url);
    });

    it('calls for multiples urls', function() {
      var urls = ['url-a-1.css', 'url-a-2.css'];
      spf.net.style.prefetch(urls);
      spf.array.each(urls, function(url) {
        expect(spf.net.resource.prefetch).toHaveBeenCalledWith(CSS, url);
      });
    });

  });


});
