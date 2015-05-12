// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for handling connections (i.e. pre-resolving DNS
 * and establishing the TCP AND TLS handshake).
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.connect');

goog.require('spf.array');
goog.require('spf.net.resource');
goog.require('spf.tracing');


/**
 * Preconnects to a URL.
 * Use to both resolve DNS and establish connections before requests are made.
 *
 * @param {string|Array.<string>} urls One or more URLs to preconnect.
 */
spf.net.connect.preconnect = function(urls) {
  // Use an <img> tag to handle the preconnect in a compatible manner.
  var type = spf.net.resource.Type.IMG;
  // Convert to an array if needed.
  urls = spf.array.toArray(urls);
  spf.array.each(urls, function(url) {
    // When preconnecting, always fetch the image and make the request.
    // This is necessary to consistenly establish connections to repeat
    // URLs when the keep-alive time is shorter than the interval between
    // attempts.
    spf.net.resource.prefetch(type, url, true);  // Force repeat fetching.
  });
};


if (spf.tracing.ENABLED) {
  (function() {
    spf.net.connect.preconnect = spf.tracing.instrument(
        spf.net.connect.preconnect, 'spf.net.connect.preconnect');
  })();
}
