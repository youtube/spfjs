/**
 * @fileoverview Simple publish/subscribe instance used as a "dispatch"
 * for centralized notifications.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.pubsub');

goog.require('spf.state');


/**
 * Subscribes a function to a topic.  The function is invoked in the global
 * scope.  Subscribing the same function to the same topic multiple
 * times will result in multiple function invocations while publishing.
 *
 * @param {string} topic Topic to subscribe to.
 * @param {Function} fn Function to be invoked when a message is published to
 *     the given topic.
 */
spf.pubsub.subscribe = function(topic, fn) {
  if (topic && fn) {
    var subs = spf.pubsub.subscriptions_();
    if (!(topic in subs)) {
      subs[topic] = [];
    }
    subs[topic].push(fn);
  }
};


/**
 * Unsubscribes a function from a topic.  Only deletes the first match found.
 *
 * @param {string} topic Topic to unsubscribe from.
 * @param {Function} fn Function to unsubscribe.
 */
spf.pubsub.unsubscribe = function(topic, fn) {
  var subs = spf.pubsub.subscriptions_();
  if (topic in subs && fn) {
    for (var i = 0, l = subs[topic].length; i < l; i++) {
      if (subs[topic][i] == fn) {
        subs[topic][i] = null;
        return;
      }
    }
  }
};


/**
 * Publishes a message to a topic.  Calls functions subscribed to the topic in
 * the order in which they were added, passing all arguments along.  If any of
 * the functions throws an uncaught error, publishing is aborted.
 *
 * @param {string} topic Topic to publish to.
 * @param {...*} var_args Arguments that are applied to each subscription
 *     function.
 */
spf.pubsub.publish = function(topic, var_args) {
  var subs = spf.pubsub.subscriptions_();
  if (topic in subs) {
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0, l = subs[topic].length; i < l; i++) {
      if (subs[topic][i]) {
        subs[topic][i].apply(null, args);
      }
    }
  }
};


/**
 * Clears the subscription list for a topic, or all topics if unspecified.
 *
 * @param {string=} opt_topic Topic to clear (all topics if unspecified).
 */
spf.pubsub.clear = function(opt_topic) {
  var subs = spf.pubsub.subscriptions_();
  if (opt_topic) {
    if (opt_topic in subs) {
      delete subs[opt_topic];
    }
  } else {
    spf.pubsub.subscriptions_({});
  }
};


/**
 * @param {!Object.<string, Array>=} opt_subs Optional map of subscriptions
 *     to overwrite the current value.
 * @return {!Object.<string, Array>} Current map of subscriptions.
 * @private
 */
spf.pubsub.subscriptions_ = function(opt_subs) {
  if (opt_subs || !spf.state.has('pubsub-subs')) {
    return /** @type {!Object.<string, Array>} */ (
        spf.state.set('pubsub-subs', (opt_subs || {})));
  }
  return /** @type {!Object.<string, Array>} */ (
      spf.state.get('pubsub-subs'));
};
