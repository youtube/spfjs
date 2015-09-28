// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for asynchronous queued task execution.
 */


goog.require('spf.config');
goog.require('spf.tasks');


describe('spf.tasks', function() {

  var MOCK_DELAY = 10;
  var trackingObject = {};

  var fakeScheduler = {
    addTask: function(fn) {
      return setTimeout(fn, 0);
    },
    cancelTask: function(key) {
      clearTimeout(key);
    }
  };

  var createFakeTask = function(name) {
    return function() {
      if (name in trackingObject) {
        trackingObject[name]++;
      } else {
        trackingObject[name] = 1;
      }
    };
  };


  beforeEach(function() {
    trackingObject = {};
    spf.config.set('advanced-task-scheduler', null);
    jasmine.clock().install();
  });


  afterEach(function() {
    jasmine.clock().uninstall();
    spf.tasks.cancel('queue');
  });


  it('builds a correct key', function() {
    var obj1 = {};
    var obj2 = {};
    // No keys.
    expect('spf-key' in obj1).toBe(false);
    expect('spf-key' in obj2).toBe(false);
    // First object key.
    var key1a = spf.tasks.key(obj1);
    expect('spf-key' in obj1).toBe(true);
    expect('spf-key' in obj2).toBe(false);
    // Repeat gives same key.
    var key1b = spf.tasks.key(obj1);
    expect(key1a).toEqual(key1b);
    // Second object key.
    var key2a = spf.tasks.key(obj2);
    expect('spf-key' in obj1).toBe(true);
    expect('spf-key' in obj2).toBe(true);
    // Repeat gives same key.
    var key2b = spf.tasks.key(obj2);
    expect(key2a).toEqual(key2b);
    // First and second keys are different.
    expect(key1a).not.toEqual(key2a);
    // Multiple calls gives a unique value.
    var keys = [];
    for (var i = 0; i < 100; i++) {
      var key = spf.tasks.key({});
      expect(keys).not.toContain(key);
      keys.push(key);
    }
  });


  it('processes tasks synchronously', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', createFakeTask('task2'));
    // Nothing in executed from an add.
    expect('task1' in trackingObject).toBe(false);
    expect('task2' in trackingObject).toBe(false);
    // Both tasks should be run once.
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
    // Further runs shouldn't change anything.
    spf.tasks.run('queue', true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
  });


  it('processes tasks asynchronously', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', createFakeTask('task2'));
    // Both tasks should be run once asynchronously.
    spf.tasks.run('queue');
    expect('task1' in trackingObject).toBe(false);
    expect('task2' in trackingObject).toBe(false);
    jasmine.clock().tick(1);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
    // Further runs shouldn't change anything.
    spf.tasks.run('queue');
    jasmine.clock().tick(1);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
  });


  it('calls the scheduler when available and asynchronous', function() {
    spyOn(fakeScheduler, 'addTask').and.callThrough();
    spf.config.set('advanced-task-scheduler', fakeScheduler);
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', createFakeTask('task2'));
    // Synchronous execution should not call the scheduler.
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(true);
    expect(fakeScheduler.addTask).not.toHaveBeenCalled();
    // Asynchronous execution should use the scheduler.
    spf.tasks.add('queue', createFakeTask('task3'));
    spf.tasks.run('queue');
    jasmine.clock().tick(1);
    expect('task3' in trackingObject).toBe(true);
    expect(fakeScheduler.addTask).toHaveBeenCalled();
  });


  it('processes tasks with a delay', function() {
    spf.tasks.add('queue', createFakeTask('task1'), MOCK_DELAY);
    spf.tasks.add('queue', createFakeTask('task2'), MOCK_DELAY);
    // Both tasks should be run once asynchronously.
    spf.tasks.run('queue');
    expect('task1' in trackingObject).toBe(false);
    expect('task2' in trackingObject).toBe(false);
    jasmine.clock().tick(MOCK_DELAY + 1);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(false);
    jasmine.clock().tick(MOCK_DELAY);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
    // Further runs shouldn't change anything.
    spf.tasks.run('queue');
    jasmine.clock().tick(MOCK_DELAY);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
  });


  it('ignores delays from a synchronous run', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', createFakeTask('task2'), MOCK_DELAY);
    spf.tasks.add('queue', createFakeTask('task3'));
    // Synchronous tasks should be run immediately, while a delay should be
    // asynchronous.
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
    expect(trackingObject['task3']).toEqual(1);
    // Further runs shouldn't change anything.
    spf.tasks.run('queue', true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
    expect(trackingObject['task3']).toEqual(1);
  });


  it('overrides active state when run synchronously.', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', createFakeTask('task2'), MOCK_DELAY);
    spf.tasks.add('queue', createFakeTask('task3'));
    // Running synchronously should ignore active state and continue processing.
    spf.tasks.run('queue');
    jasmine.clock().tick(1);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(false);
    expect('task3' in trackingObject).toBe(false);
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task2' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task2']).toEqual(1);
    expect(trackingObject['task3']).toEqual(1);
  });


  it('can suspend the task queue', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', function() {
      spf.tasks.suspend('queue');
    });
    spf.tasks.add('queue', createFakeTask('task3'));
    // The suspention should stop the execution.
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(false);
    // A subsequent run call should be a noop.
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(false);
    // A resume should finish the execution.
    spf.tasks.resume('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task3']).toEqual(1);
  });


  it('can suspend a queue when async', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', function() {
      spf.tasks.suspend('queue');
    });
    spf.tasks.add('queue', createFakeTask('task3'));
    // The suspention should stop the execution.
    spf.tasks.run('queue');
    expect('task1' in trackingObject).toBe(false);
    expect('task3' in trackingObject).toBe(false);
    jasmine.clock().tick(1);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(false);
    // A subsequent run call should be a noop.
    spf.tasks.run('queue');
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(false);
    // A resume should finish the execution.
    spf.tasks.resume('queue');
    jasmine.clock().tick(1);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(true);
    expect(trackingObject['task1']).toEqual(1);
    expect(trackingObject['task3']).toEqual(1);
  });


  it('can cancel execution when suspended', function() {
    spf.tasks.add('queue', createFakeTask('task1'));
    spf.tasks.add('queue', function() {
      spf.tasks.suspend('queue');
    });
    spf.tasks.add('queue', createFakeTask('task3'));
    // The suspention should stop the execution.
    spf.tasks.run('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(false);
    // Canceling should remove all later tasks.
    spf.tasks.cancel('queue');
    spf.tasks.resume('queue', true);
    expect('task1' in trackingObject).toBe(true);
    expect('task3' in trackingObject).toBe(false);
    expect(trackingObject['task1']).toEqual(1);
  });


  it('cancels asynchronous tasks', function() {
    // Jasmine's clearTimeout mocks don't work in IE8, so skip these tests in
    // that scenario.
    if (window.clearTimeout != clearTimeout) {
      return;
    }
    spf.tasks.add('queue', createFakeTask('task1'));
    // Canceling during a delay should cancel the async task.
    spf.tasks.run('queue');
    expect('task1' in trackingObject).toBe(false);
    spf.tasks.cancel('queue');
    jasmine.clock().tick(1);
    expect('task1' in trackingObject).toBe(false);
  });


  it('cancels scheduled tasks', function() {
    // Jasmine's clearTimeout mocks don't work in IE8, so skip these tests in
    // that scenario.
    if (window.clearTimeout != clearTimeout) {
      return;
    }
    spyOn(fakeScheduler, 'addTask').and.callThrough();
    spyOn(fakeScheduler, 'cancelTask').and.callThrough();
    spf.config.set('advanced-task-scheduler', fakeScheduler);
    spf.tasks.add('queue', createFakeTask('task1'));
    // Canceling during a delay should cancel the async task.
    spf.tasks.run('queue');
    expect('task1' in trackingObject).toBe(false);
    expect(fakeScheduler.addTask).toHaveBeenCalled();
    spf.tasks.cancel('queue');
    jasmine.clock().tick(1);
    expect('task1' in trackingObject).toBe(false);
    expect(fakeScheduler.cancelTask).toHaveBeenCalled();
  });


});
