/**
 * @fileoverview Tests for publish/subscribe notifications.
 */

goog.require('spf.pubsub');


describe('spf.pubsub', function() {

  var subs;

  beforeEach(function() {
    subs = spf.pubsub.subscriptions_();
  });

  afterEach(function() {
    spf.pubsub.subscriptions_({});
    subs = null;
  });

  it('subscribe', function() {
    var foo = {
      one: function() {},
      two: function() {}
    };
    // No subscriptions.
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    // One subscription.
    spf.pubsub.subscribe('foo', foo.one);
    expect(subs['foo'] || []).toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    // Two subscriptions.
    spf.pubsub.subscribe('foo', foo.two);
    expect(subs['foo'] || []).toContain(foo.one);
    expect(subs['foo'] || []).toContain(foo.two);
  });

  it('unsubscribe', function() {
    var foo = {
      one: function() {},
      two: function() {}
    };
    var bar = {
      one: function() {},
      two: function() {}
    };
    spf.pubsub.subscribe('foo', foo.one);
    spf.pubsub.subscribe('foo', foo.two);
    spf.pubsub.subscribe('bar', bar.one);
    spf.pubsub.subscribe('bar', bar.two);
    // Two subscriptions.
    expect(subs['foo'] || []).toContain(foo.one);
    expect(subs['foo'] || []).toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // One subscription.
    spf.pubsub.unsubscribe('foo', foo.one);
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // No subscriptions.
    spf.pubsub.unsubscribe('foo', foo.two);
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // Unknown topic or missing function.
    expect(function() {spf.pubsub.unsubscribe('_', bar.one)}).not.toThrow();
    expect(function() {spf.pubsub.unsubscribe('bar', null)}).not.toThrow();
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
  });

  it('publish', function() {
    var foo = {
      one: function() {},
      two: function() {}
    };
    spyOn(foo, 'one');
    spyOn(foo, 'two');
    spf.pubsub.subscribe('foo', foo.one);
    spf.pubsub.subscribe('foo', foo.two);
    // Two subscriptions.
    spf.pubsub.publish('foo');
    spf.pubsub.publish('bar');
    expect(foo.one.calls.length).toEqual(1);
    expect(foo.two.calls.length).toEqual(1);
    // One subscription.
    spf.pubsub.unsubscribe('foo', foo.one);
    spf.pubsub.publish('foo');
    spf.pubsub.publish('bar');
    expect(foo.one.calls.length).toEqual(1);
    expect(foo.two.calls.length).toEqual(2);
    // No subscriptions.
    spf.pubsub.unsubscribe('foo', foo.two);
    spf.pubsub.publish('foo');
    spf.pubsub.publish('bar');
    expect(foo.one.calls.length).toEqual(1);
    expect(foo.two.calls.length).toEqual(2);
  });

  it('clear', function() {
    var foo = {
      one: function() {},
      two: function() {}
    };
    var bar = {
      one: function() {},
      two: function() {}
    };
    spf.pubsub.subscribe('bar', bar.one);
    spf.pubsub.subscribe('bar', bar.two);
    // No subscriptions.
    spf.pubsub.clear('foo');
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // One subscription.
    spf.pubsub.subscribe('foo', foo.one);
    spf.pubsub.clear('foo');
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // Two subscriptions.
    spf.pubsub.subscribe('foo', foo.one);
    spf.pubsub.subscribe('foo', foo.two);
    spf.pubsub.clear('foo');
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // Unknown topic.
    spf.pubsub.clear('_');
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    expect(subs['bar'] || []).toContain(bar.one);
    expect(subs['bar'] || []).toContain(bar.two);
    // All topics.
    spf.pubsub.clear();
    subs = spf.pubsub.subscriptions_(); // Needed for testing after full clear.
    expect(subs['foo'] || []).not.toContain(foo.one);
    expect(subs['foo'] || []).not.toContain(foo.two);
    expect(subs['bar'] || []).not.toContain(bar.one);
    expect(subs['bar'] || []).not.toContain(bar.two);
  });

});
