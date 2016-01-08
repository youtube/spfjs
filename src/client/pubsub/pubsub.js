// Copyright 2012 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Simple publish/subscribe instance used as a "dispatch"
 * for centralized notifications.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.pubsub');

goog.require('spf');
goog.require('spf.array');
goog.require('spf.state');


/**
 * Subscribes a function to a topic.  The function is invoked in the global
 * scope.  Subscribing the same function to the same topic multiple
 * times will result in multiple function invocations while publishing.
 *
 * @param {string} topic Topic to subscribe to. Passing an empty string does
 *     nothing.
 * @param {Function|undefined} fn Function to be invoked when a message is
 *     published to the given topic. Passing `null` or `undefined`
 *     does nothing.
 */
spf.pubsub.subscribe = function(topic, fn) {
  if (topic && fn) {
    if (!(topic in spf.pubsub.subscriptions)) {
      spf.pubsub.subscriptions[topic] = [];
    }
    spf.pubsub.subscriptions[topic].push(fn);
  }
};


/**
 * Unsubscribes a function from a topic. Only deletes the first match found.
 *
 * @param {string} topic Topic to unsubscribe from. Passing an empty string does
 *     nothing.
 * @param {Function|undefined} fn Function to unsubscribe. Passing `null`
 *     or `undefined` does nothing.
 */
spf.pubsub.unsubscribe = function(topic, fn) {
  if (topic in spf.pubsub.subscriptions && fn) {
    spf.array.every(spf.pubsub.subscriptions[topic], function(subFn, i, arr) {
      if (subFn == fn) {
        arr[i] = null;
        return false;
      }
      return true;
    });
  }
};


/**
 * Publishes a topic.  Calls functions subscribed to the topic in
 * the order in which they were added.  If any of the functions throws an
 * uncaught error, publishing is aborted.
 *
 * @param {string} topic Topic to publish. Passing an empty string does
 *     nothing.
 */
spf.pubsub.publish = function(topic) {
  spf.pubsub.publish_(topic);
};


/**
 * Simulaneously publishes and clears a topic.  Calls functions subscribed to
 * topic in the order in which they were added, unsubscribing each beforehand.
 * If any of the functions throws an uncaught error, publishing is aborted.
 * See {#publish} and {#clear}.
 *
 * @param {string} topic Topic to publish. Passing an empty string does
 *     nothing.
 */
spf.pubsub.flush = function(topic) {
  spf.pubsub.publish_(topic, true);
};


/**
 * See {@link #publish} or {@link #flush}.
 *
 * @param {string} topic Topic to publish.
 * @param {boolean=} opt_unsub Whether to unsubscribe functions beforehand.
 * @private
 */
spf.pubsub.publish_ = function(topic, opt_unsub) {
  if (topic in spf.pubsub.subscriptions) {
    spf.array.each(spf.pubsub.subscriptions[topic], function(subFn, i, arr) {
      if (opt_unsub) {
        arr[i] = null;
      }
      if (subFn) {
        subFn();
      }
    });
  }
};


/**
 * Renames a topic.  All functions subscribed to the old topic will then
 * be subscribed to the new topic instead.
 *
 * @param {string} oldTopic The old name for the topic. Passing an empty string
 *     does nothing.
 * @param {string} newTopic The new name for the topic. Passing an empty string
 *     does nothing.
 */
spf.pubsub.rename = function(oldTopic, newTopic) {
  if (oldTopic && newTopic && oldTopic in spf.pubsub.subscriptions) {
    var existing = spf.pubsub.subscriptions[newTopic] || [];
    spf.pubsub.subscriptions[newTopic] =
        existing.concat(spf.pubsub.subscriptions[oldTopic]);
    spf.pubsub.clear(oldTopic);
  }
};


/**
 * Clears the subscription list for a topic.
 *
 * @param {string} topic Topic to clear.
 */
spf.pubsub.clear = function(topic) {
  delete spf.pubsub.subscriptions[topic];
};


/**
 * Map of subscriptions.
 * @type {!Object.<Array>}
 */
spf.pubsub.subscriptions = {};


// Automatic initialization for spf.pubsub.subscriptions.
// When built for the bootloader, unconditionally set in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.state.Key.PUBSUB_SUBS, spf.pubsub.subscriptions);
} else {
  if (!spf.state.has(spf.state.Key.PUBSUB_SUBS)) {
    spf.state.set(spf.state.Key.PUBSUB_SUBS, spf.pubsub.subscriptions);
  }
  spf.pubsub.subscriptions = /** @type {!Object.<Array>} */ (
      spf.state.get(spf.state.Key.PUBSUB_SUBS));
}
