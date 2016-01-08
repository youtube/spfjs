// Copyright 2013 Google Inc. All rights reserved.
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
goog.require('spf.config');
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
    var active = !!queue.scheduledKey || !!queue.timeoutKey;
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
 * `suspend` decrements a value, and each `resume` increments it.
 * Queue execution only continues when the values are positive, so while
 * `suspend` may be called multiple times, it must be matched by an equal
 * number of `resume` calls.
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
 * `suspend` decrements a value, and each `resume` increments it.
 * Queue execution only continues when the values are positive, so while
 * `suspend` may be called multiple times, it much be matched by an equal
 * number of `resume` calls.
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
    spf.tasks.clearAsyncTasks_(queue);
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
    spf.tasks.clearAsyncTasks_(queue);
    if (queue.semaphore > 0 && queue.items.length) {
      var task = queue.items[0];
      if (task) {
        var next = spf.bind(spf.tasks.do_, null, key, opt_sync);
        var step = spf.bind(function(nextFn, taskFn) {
          taskFn();
          nextFn();
        }, null, next);
        if (opt_sync) {
          queue.items.shift();
          step(task.fn);
        } else {
          spf.tasks.scheduleTask_(queue, task, step);
        }
      }
    }
  }
};


/**
 * Schedule a task for asynchronous execution.
 * @param {!spf.tasks.Queue} queue The current queue being executed.
 * @param {!spf.tasks.Task} task The task to be scheduled.
 * @param {!Function} step The task execution function.
 * @private
 */
spf.tasks.scheduleTask_ = function(queue, task, step) {
  if (task.delay) {
    // For a delay an empty step is run, and the task's functionality is saved
    // for the next step.
    var fn = spf.bind(step, null, spf.nullFunction);
    queue.timeoutKey = setTimeout(fn, task.delay);
    // Instead of removing the task from the queue, set it's delay to 0 so it
    // will be processed traditionally on the next step.
    task.delay = 0;
  } else {
    queue.items.shift();
    var fn = spf.bind(step, null, task.fn);
    var scheduler = /** @type {spf.TaskScheduler} */ (
        spf.config.get('advanced-task-scheduler'));
    var addTask = scheduler && scheduler['addTask'];
    if (addTask) {
      queue.scheduledKey = addTask(fn);
    } else {
      queue.timeoutKey = setTimeout(fn, 0);
    }
  }
};


/**
 * Clear the current asynchronous tasks.
 * @param {!spf.tasks.Queue} queue The queue.
 * @private
 */
spf.tasks.clearAsyncTasks_ = function(queue) {
  if (queue.scheduledKey) {
    var scheduler = /** @type {spf.TaskScheduler} */ (
        spf.config.get('advanced-task-scheduler'));
    var cancelTask = scheduler && scheduler['cancelTask'];
    if (cancelTask) {
      cancelTask(queue.scheduledKey);
    }
    queue.scheduledKey = 0;
  }
  if (queue.timeoutKey) {
    clearTimeout(queue.timeoutKey);
    queue.timeoutKey = 0;
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
 * - scheduledKey: A key to track the current scheduled task.
 * - timeoutKey: A key to track the current task delayed by a timeout.
 * - semaphore: A POSIX Semaphore style value used to control suspending and
 *     resuming a running queue.
 *
 * @typedef {{
 *   items: !Array.<spf.tasks.Task>,
 *   scheduledKey: number,
 *   timeoutKey: number,
 *   semaphore: number
 * }}
 */
spf.tasks.Queue;


/**
 * @return {spf.tasks.Queue}
 * @private
 */
spf.tasks.createQueue_ = function() {
  return {items: [], scheduledKey: 0, timeoutKey: 0, semaphore: 1};
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
