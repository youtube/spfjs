// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for history management.
 */

goog.require('spf.history');


describe('spf.history', function() {

  var callbacks;
  var stack;
  var time;

  beforeEach(function() {
    // History tests are not run unless the events are supported.
    if (!window.addEventListener) {
      return;
    }
    // Mock history modification.
    stack = [];
    spf.history.__getCurrentUrl_ = spf.history.getCurrentUrl_;
    spf.history.__getCurrentState_ = spf.history.getCurrentState_;
    spf.history.__doPushState_ = spf.history.doPushState_;
    spf.history.__doReplaceState_ = spf.history.doReplaceState_;
    spf.history.getCurrentUrl_ = function() {
      return (stack.length) ? stack[stack.length - 1].url : '/start';
    };
    spf.history.getCurrentState_ = function() {
      return (stack.length) ? stack[stack.length - 1].state : null;
    };
    spf.history.doPushState_ = function(data, title, opt_url) {
      stack.push({ state: data, title: title, url: opt_url });
    };
    spf.history.doReplaceState_ = function(data, title, opt_url) {
      stack.pop();
      stack.push({ state: data, title: title, url: opt_url });
    };
    spyOn(spf.history, 'doPushState_').and.callThrough();
    spyOn(spf.history, 'doReplaceState_').and.callThrough();
    spyOn(window.history, 'back').and.callFake(function() {
      var evt = stack.pop();
      spf.history.pop_(evt);
    });
    // Mock timestamp generation.
    time = { advance: 0 };
    spf.__now = spf.now;
    spf.now = function() {
      return (new Date()).getTime() + time.advance;
    };
    // Init.
    callbacks = {
      one: jasmine.createSpy('one'),
      err: jasmine.createSpy('err')
    };
    spf.history.init(callbacks.one, callbacks.err);
  });

  afterEach(function() {
    // History tests are not run unless the events are supported.
    if (!window.addEventListener) {
      return;
    }
    spf.history.dispose();
    callbacks = null;
    spf.now = spf.__now;
    spf.history.getCurrentUrl_ = spf.history.__getCurrentUrl_;
    spf.history.getCurrentState_ = spf.history.__getCurrentState_;
    spf.history.doPushState_ = spf.history.__doPushState_;
    spf.history.doReplaceState_ = spf.history.__doReplaceState_;
    stack = null;
  });

  it('add', function() {
    // History tests are not run unless the events are supported.
    if (!window.addEventListener) {
      return;
    }
    var getEntry = function(n) { return stack[stack.length - n]; };
    // Start with the initial entry.
    expect(stack.length).toBe(1);
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(1);
    // Add an entry without executing the callback.
    time.advance = 100;
    spf.history.add('/foo');
    expect(stack.length).toBe(2);
    expect(spf.history.doPushState_.calls.count()).toEqual(1);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(1);
    expect(callbacks.one).not.toHaveBeenCalled();
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(
        getEntry(2).state['spf-timestamp']);
    expect(getEntry(1).url).toEqual('/foo');
    // Add an entry and execute the callback.
    time.advance = 200;
    spf.history.add('/bar', null, true);
    expect(stack.length).toBe(3);
    expect(spf.history.doPushState_.calls.count()).toEqual(2);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(1);
    expect(callbacks.one).toHaveBeenCalled();
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(
        getEntry(2).state['spf-timestamp']);
    expect(getEntry(1).url).toEqual('/bar');
  });

  it('replace', function() {
    // History tests are not run unless the events are supported.
    if (!window.addEventListener) {
      return;
    }
    var getEntry = function(n) { return stack[stack.length - n]; };
    // Start with the initial entry.
    expect(stack.length).toBe(1);
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(1);
    // Replace the top entry without executing the callback.
    time.advance = 100;
    spf.history.replace('/foo');
    expect(stack.length).toBe(1);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(2);
    expect(callbacks.one).not.toHaveBeenCalled();
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(getEntry(1).url).toEqual('/foo');
    // Replace the top entry and execute the callback.
    time.advance = 200;
    spf.history.replace('/foo', null, true);
    expect(stack.length).toBe(1);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(3);
    expect(callbacks.one).toHaveBeenCalled();
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(getEntry(1).url).toEqual('/foo');
    // Replace the top entry's url and maintain state.
    time.advance = 300;
    spf.history.replace('/foo', {'test': 'state'});
    time.advance = 400;
    spf.history.replace('/bar');
    expect(stack.length).toBe(1);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(5);
    expect(getEntry(1).state['test']).toEqual('state');
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(getEntry(1).url).toEqual('/bar');
  });

  it('removeCurrentEntry', function() {
    // History tests are not run unless the events are supported.
    if (!window.addEventListener) {
      return;
    }
    var getEntry = function(n) { return stack[stack.length - n]; };
    // Start with the initial entry.
    expect(stack.length).toBe(1);
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(1);
    // Add entries without executing the callback.
    time.advance = 100;
    spf.history.add('/foo');
    time.advance = 200;
    spf.history.add('/bar');
    // Simulate a back button pop event.
    time.advance = 300;
    window.history.back();
    expect(callbacks.one.calls.count()).toEqual(1);
    // Re-add Entry.
    time.advance = 200;
    spf.history.add('/bar');
    // Call removeCurrentEntry instead.
    time.advance = 300;
    spf.history.removeCurrentEntry();
    expect(callbacks.one.calls.count()).toEqual(1);
    // Test subsequent back.
    time.advance = 300;
    window.history.back();
    expect(callbacks.one.calls.count()).toEqual(2);
  });

  it('pop_', function() {
    // History tests are not run unless the events are supported.
    if (!window.addEventListener) {
      return;
    }
    var getEntry = function(n) { return stack[stack.length - n]; };
    // Start with the initial entry.
    expect(stack.length).toBe(1);
    expect(getEntry(1).state['spf-timestamp']).toBeGreaterThan(0);
    expect(spf.history.doPushState_.calls.count()).toEqual(0);
    expect(spf.history.doReplaceState_.calls.count()).toEqual(1);
    // Add entries without executing the callback.
    time.advance = 100;
    spf.history.add('/foo');
    time.advance = 200;
    spf.history.add('/bar');
    // Simulate a back button pop event.
    time.advance = 300;
    var prev = stack.pop();
    var evt = { state: getEntry(1).state };
    spf.history.pop_(evt);
    expect(evt.state['spf-back']).toBe(true);
    expect(callbacks.one.calls.count()).toEqual(1);
    // Simulate a forward button pop event.
    time.advance = 400;
    stack.push(prev);
    var evt = { state: getEntry(1).state };
    spf.history.pop_(evt);
    expect(evt.state['spf-back']).toBe(false);
    expect(callbacks.one.calls.count()).toEqual(2);
  });

});
