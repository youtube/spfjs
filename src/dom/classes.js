// Copyright 2012 Google Inc. All Rights Reserved.

/**
 * @fileoverview Element class manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.dom.classes');


/**
 * Returns an array of class names on a node.
 *
 * @param {Node|EventTarget} node DOM node to evaluate.
 * @return {!Array} Array of class names on the node.
 */
spf.dom.classes.get = function(node) {
  return node.className && node.className.match(/\S+/g) || [];
};


/**
 * Returns true if a node has a class.
 *
 * @param {Node|EventTarget} node DOM node to test.
 * @param {string} cls Class name to test for.
 * @return {boolean} Whether node has the class.
 */
spf.dom.classes.has = function(node, cls) {
  var classes = spf.dom.classes.get(node);
  return Array.prototype.indexOf.call(classes, cls) != -1;
};


/**
 * Adds a class to a node. Does not add multiples.
 *
 * @param {Node|EventTarget} node DOM node to add class to.
 * @param {string} cls Class name to add.
 */
spf.dom.classes.add = function(node, cls) {
  if (!spf.dom.classes.has(node, cls)) {
    node.className += ' ' + cls;
  }
};


/**
 * Removes a class from a node.
 *
 * @param {Node|EventTarget} node DOM node to remove class from.
 * @param {string} cls Class name to remove.
 */
spf.dom.classes.remove = function(node, cls) {
  var classes = spf.dom.classes.get(node);
  classes = Array.prototype.filter.call(classes, function(item) {
    return item != cls;
  });
  node.className = classes.join(' ');
};
