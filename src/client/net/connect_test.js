// Copyright 2015 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for handling connections.
 */

goog.require('spf.array');
goog.require('spf.net.connect');
goog.require('spf.net.resource');


describe('spf.net.connect', function() {

  var IMG = spf.net.resource.Type.IMG;

  beforeEach(function() {
    spyOn(spf.net.resource, 'prefetch');
  });


  describe('preconnect', function() {

    it('calls for a single url', function() {
      var url = 'url/a';
      var force = true;
      spf.net.connect.preconnect(url);
      expect(spf.net.resource.prefetch).toHaveBeenCalledWith(IMG, url, force);
    });

    it('calls for multiples urls', function() {
      var urls = ['url/b-1', 'url/b-2'];
      var force = true;
      spf.net.connect.preconnect(urls);
      spf.array.each(urls, function(url) {
        expect(spf.net.resource.prefetch).toHaveBeenCalledWith(
            IMG, url, force);
      });
    });

  });


});
