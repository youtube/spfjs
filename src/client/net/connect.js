// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Functions for handling connections (i.e. pre-resolving DNS).
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.net.connect');

goog.require('spf.array');
goog.require('spf.net.resource');
goog.require('spf.tracing');


/**
 * Preconnects to a URL.
 * Use to both resolve DNS and establish a socket connections before requests
 * are made.
 *
 * @param {string|Array.<string>} urls One or more URLs to preconnect.
 */
spf.net.connect.preconnect = function(urls) {
  // Use an <img> tag to handle the preconnect in a compatible manner.
  var type = spf.net.resource.Type.IMG;
  // Convert to an array if needed.
  urls = spf.array.toArray(urls);
  spf.array.each(urls, function(url) {
    spf.net.resource.prefetch(type, url);
  });
};


if (spf.tracing.ENABLED) {
  (function() {
    spf.net.connect.preconnect = spf.tracing.instrument(
        spf.net.connect.preconnect, 'spf.net.connect.preconnect');
  })();
}
