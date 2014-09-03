// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Simple asynchronous queued task execution.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.tasks');

goog.require('spf');
goog.require('spf.state');
goog.require('spf.string');
goog.require('spf.tracing');


/**
 * Adds a task to a queue to be executed asynchronously.
 *
 * @param {string} key The key to identify the task queue.
 * @param {!Function} fn The function to execute for this task.
 * @param {number=} opt_delay The time in milliseconds to wait before executing
 *     the function; defaults to 0.
 * @return {number} The number of tasks in the queue afterwards.
 */
spf.tasks.add = function(key, fn, opt_delay) {
  var queues = spf.tasks.queues_;
  var queue = queues[key];
  if (key && fn) {
    if (!queue) {
      queue = queues[key] = spf.tasks.createQueue_();
    }
    var task = spf.tasks.createTask_(fn, opt_delay || 0);
    return queue.items.push(task);
  }
  return (queue && queue.items.length) || 0;
};


/**
 * Runs queued tasks, if not already running.
 *
 * @param {string} key The key to identify the task queue.
 * @param {boolean=} opt_sync Whether to execute the queued tasks synchronously;
 *     defaults to false.
 */
spf.tasks.run = function(key, opt_sync) {
  var queue = spf.tasks.queues_[key];
  if (queue) {
    var active = queue.timer > 0;
    var suspended = !(queue.semaphore > 0);
    if (!suspended && (opt_sync || !active)) {
      spf.tasks.do_(key, opt_sync);
    }
  }
};


/**
 * Suspends execution of a running task queue.
 * See {@link #resume}.
 *
 * Queue execution is controlled by values similar to POSIX Semaphores.  Each
 * {@code suspend} decrements a value, and each {@code resume} increments it.
 * Queue execution only continues when the values are positive, so while
 * {@code suspend} may be called multiple times, it must be matched by an equal
 * number of {@code resume} calls.
 *
 * @param {string} key The key to identify the task queue.
 */
spf.tasks.suspend = function(key) {
  var queue = spf.tasks.queues_[key];
  if (queue) {
    queue.semaphore--;
  }
};


/**
 * Resumes execution of a running task queue.
 * See {@link #suspend}.
 *
 * Queue execution is controlled by values similar to POSIX Semaphores.  Each
 * {@code suspend} decrements a value, and each {@code resume} increments it.
 * Queue execution only continues when the values are positive, so while
 * {@code suspend} may be called multiple times, it much be matched by an equal
 * number of {@code resume} calls.
 *
 * @param {string} key The key to identify the task queue.
 * @param {boolean=} opt_sync Whether to execute the queued tasks synchronously;
 *     defaults to false.
 */
spf.tasks.resume = function(key, opt_sync) {
  var queue = spf.tasks.queues_[key];
  if (queue) {
    queue.semaphore++;
    spf.tasks.run(key, opt_sync);
  }
};


/**
 * Cancels execution of a running task queue.
 *
 * @param {string} key The key to identify the task queue.
 */
spf.tasks.cancel = function(key) {
  var queue = spf.tasks.queues_[key];
  if (queue) {
    clearTimeout(queue.timer);
    delete spf.tasks.queues_[key];
  }
};


/**
 * Cancels execution of all current task queues, optionally limited to
 * with a given key prefix and optionally skipping the given key.
 *
 * @param {string=} opt_keyPrefix The prefix of the tasks to be canceled.
 * @param {string=} opt_skipKey The key of the task queue that should not
 *     be canceled.
 */
spf.tasks.cancelAllExcept = function(opt_keyPrefix, opt_skipKey) {
  var keyPrefix = opt_keyPrefix || '';
  for (var key in spf.tasks.queues_) {
    if (opt_skipKey != key && spf.string.startsWith(key, keyPrefix)) {
      spf.tasks.cancel(key);
    }
  }
};


/**
 * Gets a unique key for an object.  Mutates the object to store the key so
 * that multiple calls for the same object will return the same key.
 *
 * @param {Object} obj The object to get a unique key for.
 * @return {string} The unique key.
 */
spf.tasks.key = function(obj) {
  var uid = parseInt(spf.state.get(spf.state.Key.TASKS_UID), 10) || 0;
  uid++;
  return obj['spf-key'] || (
      obj['spf-key'] = '' + spf.state.set(spf.state.Key.TASKS_UID, uid));
};


/**
 * @param {string} key The key to identify the task queue.
 * @param {boolean=} opt_sync Whether to execute the queued tasks synchronously;
 *     defaults to false.
 * @private
 */
spf.tasks.do_ = function(key, opt_sync) {
  var queue = spf.tasks.queues_[key];
  if (queue) {
    clearTimeout(queue.timer);
    queue.timer = 0;
    if (queue.semaphore > 0) {
      var task = queue.items.shift();
      if (task) {
        var next = spf.bind(spf.tasks.do_, null, key, opt_sync);
        var step = spf.bind(function(taskFn, nextFn) {
          taskFn();
          nextFn();
        }, null, task.fn, next);
        if (opt_sync) {
          step();
        } else {
          queue.timer = setTimeout(step, task.delay);
        }
      }
    }
  }
};


/**
 * Type definition for a SPF task.
 * - fn: The function to execute.
 * - delay: The time in milliseconds to wait before executing the function.
 *
 * @typedef {{
 *   fn: !Function,
 *   delay: number
 * }}
 */
spf.tasks.Task;


/**
 * Type definition for a SPF task queue.
 * - items: The ordered list of tasks.
 * - timer: The timer being used to handle delays.
 * - semaphore: A POSIX Semaphore style value used to control suspending and
 *     resuming a running queue.
 *
 * @typedef {{
 *   items: !Array.<spf.tasks.Task>,
 *   timer: number,
 *   semaphore: number
 * }}
 */
spf.tasks.Queue;


/**
 * @return {spf.tasks.Queue}
 * @private
 */
spf.tasks.createQueue_ = function() {
  return {items: [], timer: 0, semaphore: 1};
};


/**
 * @param {!Function} fn The function to execute.
 * @param {number} delay The time in milliseconds to wait before executing
 *     the function.
 * @return {spf.tasks.Task}
 * @private
 */
spf.tasks.createTask_ = function(fn, delay) {
  return {fn: fn, delay: delay};
};


/**
 * @type {!Object.<string, spf.tasks.Queue>}
 * @private
 */
spf.tasks.queues_ = {};


if (spf.tracing.ENABLED) {
  (function() {
    spf.tasks.add = spf.tracing.instrument(
        spf.tasks.add, 'spf.tasks.add');
    spf.tasks.run = spf.tracing.instrument(
        spf.tasks.run, 'spf.tasks.run');
    spf.tasks.suspend = spf.tracing.instrument(
        spf.tasks.suspend, 'spf.tasks.suspend');
    spf.tasks.resume = spf.tracing.instrument(
        spf.tasks.resume, 'spf.tasks.resume');
    spf.tasks.cancel = spf.tracing.instrument(
        spf.tasks.cancel, 'spf.tasks.cancel');
    spf.tasks.cancelAllExcept = spf.tracing.instrument(
        spf.tasks.cancelAllExcept, 'spf.tasks.cancelAllExcept');
    spf.tasks.key = spf.tracing.instrument(
        spf.tasks.key, 'spf.tasks.key');
    spf.tasks.do_ = spf.tracing.instrument(
        spf.tasks.do_, 'spf.tasks.do_');
    spf.tasks.createQueue_ = spf.tracing.instrument(
        spf.tasks.createQueue_, 'spf.tasks.createQueue_');
    spf.tasks.createTask_ = spf.tracing.instrument(
        spf.tasks.createTask_, 'spf.tasks.createTask_');
  })();
}
