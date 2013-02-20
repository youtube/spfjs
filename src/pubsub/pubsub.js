/**
 * @fileoverview Single publish/subscribe instance used as a "dispatch"
 * for centralized notifications.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.pubsub');


/**
 * Subscribes a function to a topic.  The function is invoked as a method on
 * the given {@code opt_context} object, or in the global scope if no context
 * is specified.  Subscribing the same function to the same topic multiple
 * times will result in multiple function invocations while publishing.
 *
 * @param {string} topic Topic to subscribe to.
 * @param {Function} fn Function to be invoked when a message is published to
 *     the given topic.
 * @param {Object=} opt_context Object in whose context the function is to be
 *     called (the global scope if none).
 */
spf.pubsub.subscribe = function(topic, fn, opt_context) {
  if (!(topic in spf.pubsub.subscriptions_)) {
    spf.pubsub.subscriptions_[topic] = [];
  }
  spf.pubsub.subscriptions_[topic].push([fn, opt_context]);
};


/**
 * Unsubscribes a function from a topic.  Only deletes the first match found.
 *
 * @param {string} topic Topic to unsubscribe from.
 * @param {Function} fn Function to unsubscribe.
 * @param {Object=} opt_context Object in whose context the function was to be
 *     called (the global scope if none).
 */
spf.pubsub.unsubscribe = function(topic, fn, opt_context) {
  if (topic in spf.pubsub.subscriptions_) {
    var subs = spf.pubsub.subscriptions_[topic];
    for (var i = 0, l = subs.length; i < l; i++) {
      if (subs[i] && subs[i][0] == fn && subs[i][1] == opt_context) {
        subs[i] = null;
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
  if (topic in spf.pubsub.subscriptions_) {
    var subs = spf.pubsub.subscriptions_[topic];
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0, l = subs.length; i < l; i++) {
      if (subs[i]) {
        var fn = subs[i][0];
        var context = subs[i][1];
        fn.apply(context, args);
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
  if (opt_topic) {
    if (opt_topic in spf.pubsub.subscriptions_) {
      delete spf.pubsub.subscriptions_[opt_topic];
    }
  } else {
    spf.pubsub.subscriptions_ = {};
  }
};



/**
 * Map of subscriptions.
 *
 * @type {!Object.<string, Array>}
 * @private
 */
spf.pubsub.subscriptions_ = {};
