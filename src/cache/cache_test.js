/**
 * @fileoverview Tests for data caching functions.
 */

goog.require('spf.cache');
goog.require('spf.config');


describe('spf.cache', function() {

  var storage;
  var time;

  beforeEach(function() {
    // Mock timestamp generation.
    time = { advance: 0 };
    spf.__now = spf.now;
    spf.now = function() {
      return (+new Date()) + time.advance;
    };
    // Reset.
    storage = spf.cache.storage_();
  });

  afterEach(function() {
    spf.config.clear();
    spf.cache.storage_({});
    storage = null;
    spf.now = spf.__now;
    time = null;
  });

  it('set', function() {
    expect(storage['foo']).toBeUndefined();
    spf.cache.set('foo', 'value');
    expect(storage['foo']).toBeDefined();
  });

  describe('get', function() {

    it('missing data', function() {
      expect(spf.cache.get('foo')).toBeUndefined();
    });

    it('valid data', function() {
      spf.cache.set('foo', 'value');
      expect(spf.cache.get('foo')).toEqual('value');
      var value = [1, 2, {'a': 'b'}, 3, 4];
      spf.cache.set('foo', value);
      expect(spf.cache.get('foo')).toBe(value);  // Exact match.
    });

    it('expired data', function() {
      spf.cache.set('foo', 'value1', 100);
      spf.cache.set('bar', 'value2', 200);
      expect(spf.cache.get('foo')).toEqual('value1');
      expect(spf.cache.get('bar')).toEqual('value2');
      time.advance = 100;
      expect(spf.cache.get('foo')).toBeUndefined();
      expect(spf.cache.get('bar')).toEqual('value2');
      time.advance = 200;
      expect(spf.cache.get('foo')).toBeUndefined();
      expect(spf.cache.get('bar')).toBeUndefined();
    });

    it('cache-max = finite', function() {
      spf.config.set('cache-max', 5);
      for (var i = 1; i < 6; i++) {
        spf.cache.set('foo' + i, 'value' + i);
      }
      expect(spf.cache.get('foo1')).toEqual('value1');
      expect(spf.cache.get('foo5')).toEqual('value5');
      spf.cache.set('foo6', 'value6');
      expect(spf.cache.get('foo1')).toBeUndefined();
      expect(spf.cache.get('foo6')).toEqual('value6');
    });

    it('cache-max = infinite', function() {
      spf.config.set('cache-max', null);
      for (var i = 1; i < 1000; i++) {
        spf.cache.set('foo' + i, 'value' + i);
      }
      expect(spf.cache.get('foo1')).toEqual('value1');
      expect(spf.cache.get('foo999')).toEqual('value999');
      spf.config.set('cache-max', undefined);
      for (var j = 1000; j < 2000; j++) {
        spf.cache.set('foo' + j, 'value' + j);
      }
      expect(spf.cache.get('foo1000')).toEqual('value1000');
      expect(spf.cache.get('foo1999')).toEqual('value1999');
    });

    it('cache-max = 0', function() {
      // When cache-max = 0, there is no cache.
      spf.config.set('cache-max', 0);
      for (var i = 0; i < 10; i++) {
        spf.cache.set('foo' + i, 'value' + i);
      }
      expect(spf.cache.get('foo1')).toBeUndefined();
      expect(spf.cache.get('foo9')).toBeUndefined();
      spf.config.set('cache-max', -5);
      for (var j = 10; j < 20; j++) {
        spf.cache.set('foo' + j, 'value' + j);
      }
      expect(spf.cache.get('foo10')).toBeUndefined();
      expect(spf.cache.get('foo19')).toBeUndefined();
    });

  });

  it('remove', function() {
    expect(function() {spf.cache.remove('foo')}).not.toThrow();
    spf.cache.set('foo', 'value');
    expect(spf.cache.get('foo')).toEqual('value');
    spf.cache.remove('foo');
    expect(storage['foo']).toBeUndefined();
  });

  it('clear', function() {
    spf.cache.set('foo', 'value1');
    spf.cache.set('bar', 'value2');
    spf.cache.clear();
    storage = spf.cache.storage_(); // Needed for testing after full clear.
    expect(spf.cache.get('foo')).toBeUndefined();
    expect(spf.cache.get('bar')).toBeUndefined();
  });

  it('collect', function() {
    spf.cache.set('foo', 'value1', 100);
    spf.cache.set('bar', 'value2', 200);
    spf.cache.collect();
    expect('foo' in storage).toBe(true);
    expect('bar' in storage).toBe(true);
    time.advance = 100;
    spf.cache.collect();
    expect('foo' in storage).toBe(false);
    expect('bar' in storage).toBe(true);
    time.advance = 200;
    spf.cache.collect();
    expect('foo' in storage).toBe(false);
    expect('bar' in storage).toBe(false);
  });

});
