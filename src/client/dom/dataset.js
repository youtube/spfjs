// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Element dataset manipulation functions.
 * See {@link http://www.w3.org/TR/html5/Overview.html#dom-dataset}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.dom.dataset');


/**
 * Gets a custom data attribute from a node. The key should be in
 * camelCase format (e.g "keyName" for the "data-key-name" attribute).
 *
 * @param {Node} node DOM node to get the custom data attribute from.
 * @param {string} key Key for the custom data attribute.
 * @return {?string} The attribute value, if it exists.
 */
spf.dom.dataset.get = function(node, key)  {
  if (node.dataset) {
    return node.dataset[key];
  } else {
    return node.getAttribute('data-' + spf.string.toSelectorCase(key));
  }
};


/**
 * Sets a custom data attribute on a node. The key should be in
 * camelCase format (e.g "keyName" for the "data-key-name" attribute).
 *
 * @param {Node} node DOM node to set the custom data attribute on.
 * @param {string} key Key for the custom data attribute.
 * @param {string} val Value for the custom data attribute.
 */
 spf.dom.dataset.set = function(node, key, val)  {
  if (node.dataset) {
    node.dataset[key] = val;
  } else {
    node.setAttribute('data-' + spf.string.toSelectorCase(key), val);
  }
};
