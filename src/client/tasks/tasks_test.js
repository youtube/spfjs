// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for asynchronous queued task execution.
 */

goog.require('spf.tasks');


describe('spf.tasks', function() {

  it('key', function() {
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

});
