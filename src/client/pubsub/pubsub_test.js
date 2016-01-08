// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for publish/subscribe notifications.
 */

goog.require('spf.pubsub');


describe('spf.pubsub', function() {

  var callbacks;
  var subs;

  beforeEach(function() {
    callbacks = {
      one: jasmine.createSpy('one'),
      two: jasmine.createSpy('two'),
      three: jasmine.createSpy('three'),
      four: jasmine.createSpy('four')
    };
    subs = spf.pubsub.subscriptions;
  });

  afterEach(function() {
    spf.pubsub.subscriptions = {};
    subs = null;
    callbacks = null;
  });

  it('subscribe', function() {
    // No subscriptions.
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    // One subscription.
    spf.pubsub.subscribe('foo', callbacks.one);
    expect(subs['foo'] || []).toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    // Two subscriptions.
    spf.pubsub.subscribe('foo', callbacks.two);
    expect(subs['foo'] || []).toContain(callbacks.one);
    expect(subs['foo'] || []).toContain(callbacks.two);
  });

  it('unsubscribe', function() {
    spf.pubsub.subscribe('foo', callbacks.one);
    spf.pubsub.subscribe('foo', callbacks.two);
    spf.pubsub.subscribe('bar', callbacks.three);
    spf.pubsub.subscribe('bar', callbacks.four);
    // Two subscriptions.
    expect(subs['foo'] || []).toContain(callbacks.one);
    expect(subs['foo'] || []).toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
    // One subscription.
    spf.pubsub.unsubscribe('foo', callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
    // No subscriptions.
    spf.pubsub.unsubscribe('foo', callbacks.two);
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
    // Unknown topic or missing function.
    var func1 = function() { spf.pubsub.unsubscribe('_', callbacks.three); };
    var func2 = function() { spf.pubsub.unsubscribe('bar', null); };
    expect(func1).not.toThrow();
    expect(func2).not.toThrow();
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
  });

  it('publish', function() {
    spf.pubsub.subscribe('foo', callbacks.one);
    spf.pubsub.subscribe('foo', callbacks.two);
    // Two subscriptions.
    spf.pubsub.publish('foo');
    spf.pubsub.publish('bar');
    expect(callbacks.one.calls.count()).toEqual(1);
    expect(callbacks.two.calls.count()).toEqual(1);
    // One subscription.
    spf.pubsub.unsubscribe('foo', callbacks.one);
    spf.pubsub.publish('foo');
    spf.pubsub.publish('bar');
    expect(callbacks.one.calls.count()).toEqual(1);
    expect(callbacks.two.calls.count()).toEqual(2);
    // No subscriptions.
    spf.pubsub.unsubscribe('foo', callbacks.two);
    spf.pubsub.publish('foo');
    spf.pubsub.publish('bar');
    expect(callbacks.one.calls.count()).toEqual(1);
    expect(callbacks.two.calls.count()).toEqual(2);
  });

  it('flush', function() {
    spf.pubsub.subscribe('foo', callbacks.one);
    spf.pubsub.subscribe('foo', callbacks.two);
    // Two subscriptions.
    spf.pubsub.flush('foo');
    expect(callbacks.one.calls.count()).toEqual(1);
    expect(callbacks.two.calls.count()).toEqual(1);
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    // No subscriptions.
    spf.pubsub.flush('foo');
    spf.pubsub.flush('bar');
    expect(callbacks.one.calls.count()).toEqual(1);
    expect(callbacks.two.calls.count()).toEqual(1);
  });

  it('rename', function() {
    // Subscribe.
    spf.pubsub.subscribe('foo', callbacks.one);
    spf.pubsub.subscribe('foo', callbacks.two);
    spf.pubsub.publish('foo');
    expect(callbacks.one.calls.count()).toEqual(1);
    expect(callbacks.two.calls.count()).toEqual(1);
    // Rename.
    spf.pubsub.rename('foo', 'bar');
    spf.pubsub.publish('bar');
    expect(callbacks.one.calls.count()).toEqual(2);
    expect(callbacks.two.calls.count()).toEqual(2);
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.one);
    expect(subs['bar'] || []).toContain(callbacks.two);
  });

  it('clear', function() {
    spf.pubsub.subscribe('bar', callbacks.three);
    spf.pubsub.subscribe('bar', callbacks.four);
    // No subscriptions.
    spf.pubsub.clear('foo');
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
    // One subscription.
    spf.pubsub.subscribe('foo', callbacks.one);
    spf.pubsub.clear('foo');
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
    // Two subscriptions.
    spf.pubsub.subscribe('foo', callbacks.one);
    spf.pubsub.subscribe('foo', callbacks.two);
    spf.pubsub.clear('foo');
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
    // Unknown topic.
    spf.pubsub.clear('_');
    expect(subs['foo'] || []).not.toContain(callbacks.one);
    expect(subs['foo'] || []).not.toContain(callbacks.two);
    expect(subs['bar'] || []).toContain(callbacks.three);
    expect(subs['bar'] || []).toContain(callbacks.four);
  });

});
