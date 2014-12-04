// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Helper functions for tests that use the DOM.
 *
 * @author rviscomi@google.com (Rick Viscomi)
 */

goog.provide('spf.testing.dom');

goog.require('spf.dom');


/**
 * Unique identifier for SPF test element tag names.
 *
 * @const {string}
 */
spf.testing.dom.TAG_NAME = 'spftest';


/**
 * Creates a DOM element prepopulated with test data.
 *
 * @param {string} id The element's unique ID.
 * @param {string=} opt_initialHTML Optional inner HTML of the element.
 * @param {Object.<string>=} opt_initialAttributes Optional attributes to set
 *   on the element.
 * @return {Element} The newly-created test element.
 */
spf.testing.dom.createElement = function(id, opt_initialHTML,
    opt_initialAttributes) {
  var element = document.createElement(spf.testing.dom.TAG_NAME);
  element.id = id;
  element.innerHTML = opt_initialHTML || '';
  if (opt_initialAttributes) {
    spf.dom.setAttributes(element, opt_initialAttributes);
  }
  document.body.appendChild(element);
  return element;
};


/**
 * Removes all elements with the unique test tag name.
 * See {@link #createElement}.
 */
spf.testing.dom.removeAllElements = function() {
  var elements = document.getElementsByTagName(spf.testing.dom.TAG_NAME);
  // `elements` is a live node list. Removing one of these elements from the DOM
  // also removes it from the array.
  while (elements.length) {
    document.body.removeChild(elements[0]);
  }
};
