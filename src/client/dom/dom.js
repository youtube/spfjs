// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Basic DOM manipulation functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.dom');

goog.require('spf');


/**
 * Gets nodes matching a selector.
 *
 * Note: IE8 does not support CSS3 selectors, and unsupported browsers will
 * return an empty Array.
 *
 * @param {string} selector Selector to match.
 * @param {(Document|Element)=} opt_root Optional document or element to query.
 * @return {Array.<Node>|NodeList} nodes Matching nodes.
 */
spf.dom.query = function(selector, opt_root) {
  var root = opt_root || document;
  if (root.querySelectorAll) {
    return root.querySelectorAll(selector);
  }
  return [];
};


/**
 * Inserts a new node before an existing reference node (i.e. as the previous
 * sibling). If the reference node has no parent, then does nothing.
 *
 * @param {Node} newNode Node to insert.
 * @param {Node} refNode Reference node to insert before.
 */
spf.dom.insertSiblingBefore = function(newNode, refNode) {
  refNode.parentNode.insertBefore(newNode, refNode);
};


/**
 * Inserts a new node after an existing reference node (i.e. as the next
 * sibling). If the reference node has no parent, then does nothing.
 *
 * @param {Node} newNode Node to insert.
 * @param {Node} refNode Reference node to insert after.
 */
spf.dom.insertSiblingAfter = function(newNode, refNode) {
  refNode.parentNode.insertBefore(newNode, refNode.nextSibling);
};


/**
 * Unpacks an element. That is, removes it and replace it with its children.
 * Does nothing if the element is not in the document.
 *
 * @param {Element} element The element to flatten.
 * @return {Element|undefined} The original element, detached from the document
 *     tree, sans children; or undefined, if the element was not in the document
 *     to begin with.
 */
spf.dom.unpackElement = function(element) {
  var child, parent = element.parentNode;
  if (parent && parent.nodeType != 11) {  // 11 = document fragment
    // Use IE DOM function (supported by Opera too) if available
    if (element.removeNode) {
      return /** @type {Element} */ (element.removeNode(false));
    } else {
      // Move all children of the original node up one level.
      while ((child = element.firstChild)) {
        parent.insertBefore(child, element);
      }
      // Detach the original element.
      return /** @type {Element} */ (parent.removeChild(element));
    }
  }
};


/**
 * Packs an element. That is, adds a new child and places its previous
 * children inside of the new one.
 *
 * @param {Element} element The element to pack.
 * @param {Element} container The new container of the existing children.
 */
spf.dom.packElement = function(element, container) {
  if (container) {
    var child;
    // Move all children of the original node down one level.
    while ((child = element.firstChild)) {
      container.appendChild(child);
    }
    // Attach the new parent.
    element.appendChild(container);
  }
};


/**
 * Walks up the DOM hierarchy returning the first ancestor that passes the
 * matcher function.
 *
 * @param {Node|EventTarget} element The DOM node to start with.
 * @param {function(Node) : boolean} matcher A function that returns true if
 *     the passed node matches the desired criteria.
 * @param {Node=} opt_parent The DOM node to end with.  If provided, it will
 *     be the highest point in the hierarchy walked.  If not provided, the
 *     full hierarchy will be walked.
 * @return {Node} DOM node that matched the matcher, or null if there was
 *     no match.
 */
spf.dom.getAncestor = function(element, matcher, opt_parent) {
  while (element) {
    if (matcher(element)) {
      // Found a match, return it.
      return element;
    }
    if (opt_parent && element == opt_parent) {
      // Reached the parent, return null.
      return null;
    }
    // Walk up the hierarchy.
    element = element.parentNode;
  }
  // Reached the root, return null.
  return null;
};


/**
 * Set attributes on an element from a map of attribute name/value pairs.
 *
 * NOTE: IE7 and earlier will need HTML attribute names specified as JS
 * properties instead (e.g. set "bgColor" as well as "bgcolor") and
 * does not support adding inline event handlers (e.g. setting "onclick"
 * is unsupported).  Event handlers should be added directly instead.
 *
 * @param {Element} element The element to update.
 * @param {Object.<string, string>} attributes The map of name/value pairs.
 */
spf.dom.setAttributes = function(element, attributes) {
  for (var name in attributes) {
    var value = attributes[name];
    if (name == 'class') {
      element.className = value;
    } else if (name == 'style') {
      element.style.cssText = value;
    } else {
      element.setAttribute(name, value);
      // Updating the "value" attribute of an input via `el.setAttribute` does
      // not change what is displayed, and assigning directly via `el.value` is
      // needed.  But, _only_ updating via `el.value` means that calls to
      // `el.getAttribute` will return the original value.  So, do both.
      if (name == 'value') {
        element[name] = value;
      }
    }
  }
};


/**
 * Installs an empty iframe in the page.
 *
 * @param {string=} opt_id Id of the iframe element.
 * @param {Document=} opt_document Content document element.
 * @param {Function=} opt_callback Callback function to execute onload.
 * @return {!HTMLIFrameElement}
 */
spf.dom.createIframe = function(opt_id, opt_document, opt_callback) {
  var id = opt_id || '';
  var doc = opt_document || document;
  var iframeEl = doc.createElement('iframe');
  iframeEl.id = id;
  iframeEl.src = 'javascript:""';
  iframeEl.style.display = 'none';
  if (opt_callback) {
    iframeEl.onload = spf.bind(opt_callback, null, iframeEl);
  }
  doc.body.appendChild(iframeEl);
  return /** @type {!HTMLIFrameElement} */ (iframeEl);
};
