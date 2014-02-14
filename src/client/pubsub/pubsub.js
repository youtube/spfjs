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
 * @param {string} topic Topic to subscribe to.
 * @param {Function} fn Function to be invoked when a message is published
 *     to the given topic.
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
 * Unsubscribes a function from a topic.  Only deletes the first match found.
 *
 * @param {string} topic Topic to unsubscribe from.
 * @param {Function} fn Function to unsubscribe.
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
 * @param {string} topic Topic to publish.
 */
spf.pubsub.publish = function(topic) {
  if (topic in spf.pubsub.subscriptions) {
    spf.array.each(spf.pubsub.subscriptions[topic], function(subFn) {
      if (subFn) {
        subFn();
      }
    });
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
// When built for the bootloader, unconditionally set the map in state.
if (SPF_BOOTLOADER) {
  spf.state.set(spf.pubsub.SUBS_KEY, spf.pubsub.subscriptions);
} else {
  if (SPF_BETA) {
    if (!spf.state.has(spf.pubsub.SUBS_KEY)) {
      spf.state.set(spf.pubsub.SUBS_KEY, {});
    }
    spf.pubsub.subscriptions = /** @type {!Object.<Array>} */ (
        spf.state.get(spf.pubsub.SUBS_KEY));
  } else {
    if (!spf.state.has('pubsub-subs')) {
      spf.state.set('pubsub-subs', {});
    }
    spf.pubsub.subscriptions = /** @type {!Object.<Array>} */ (
        spf.state.get('pubsub-subs'));
  }
}


/**
 * Key used to store and retrieve subscriptions in state.
 * @type {string}
 * @const
 */
spf.pubsub.SUBS_KEY = 'ps-s';
