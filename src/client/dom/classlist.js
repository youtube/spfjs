// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Element class manipulation functions.
 * See {@link http://www.w3.org/TR/html5/dom.html#classes}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.dom.classlist');

goog.require('spf.array');


/**
 * Returns an array of class names on a node.
 *
 * @param {Node|EventTarget} node DOM node to evaluate.
 * @return {{length: number}} Array-like object of class names on the node.
 */
spf.dom.classlist.get = function(node) {
  if (node.classList) {
    return node.classList;
  } else {
    return node.className && node.className.match(/\S+/g) || [];
  }
};


/**
 * Returns true if a node has a class.
 *
 * @param {Node|EventTarget} node DOM node to test.
 * @param {string} cls Class name to test for.
 * @return {boolean} Whether node has the class.
 */
spf.dom.classlist.contains = function(node, cls) {
  if (!cls) {
    return false;
  } else if (node.classList) {
    return node.classList.contains(cls);
  } else {
    var classes = spf.dom.classlist.get(node);
    return spf.array.some(classes, function(item) {
      return item == cls;
    });
  }
};


/**
 * Adds a class to a node. Does not add multiples.
 *
 * @param {Node|EventTarget} node DOM node to add class to.
 * @param {string} cls Class name to add.
 */
spf.dom.classlist.add = function(node, cls) {
  if (cls) {
    if (node.classList) {
      node.classList.add(cls);
    } else if (!spf.dom.classlist.contains(node, cls)) {
      node.className += ' ' + cls;
    }
  }
};


/**
 * Removes a class from a node.
 *
 * @param {Node|EventTarget} node DOM node to remove class from.
 * @param {string} cls Class name to remove.
 */
spf.dom.classlist.remove = function(node, cls) {
  if (cls) {
    if (node.classList) {
      node.classList.remove(cls);
    } else {
      var classes = spf.dom.classlist.get(node);
      var newClasses = spf.array.filter(classes, function(item) {
        return item != cls;
      });
      node.className = newClasses.join(' ');
    }
  }
};
