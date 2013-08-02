/**
 * @fileoverview Tests for the base SPF functions.
 */

goog.require('spf');


describe('spf', function() {

  it('execute', function() {
    var err = new Error('fail');
    var foo = {
      pass: function() { return 'pass'; },
      fail: function() { throw err; }
    };
    spyOn(foo, 'pass').andCallThrough();
    spyOn(foo, 'fail').andCallThrough();
    expect(spf.execute(foo.pass)).toEqual('pass');
    expect(foo.pass).toHaveBeenCalled();
    expect(spf.execute(foo.fail)).toEqual(err);
    expect(foo.fail).toHaveBeenCalled();
  });

  it('key', function() {
    var obj1 = {};
    var obj2 = {};
    // No keys.
    expect('spf-key' in obj1).toBe(false);
    expect('spf-key' in obj2).toBe(false);
    // First object key.
    var key1a = spf.key(obj1);
    expect('spf-key' in obj1).toBe(true);
    expect('spf-key' in obj2).toBe(false);
    // Repeat gives same key.
    var key1b = spf.key(obj1);
    expect(key1a).toEqual(key1b);
    // Second object key.
    var key2a = spf.key(obj2);
    expect('spf-key' in obj1).toBe(true);
    expect('spf-key' in obj2).toBe(true);
    // Repeat gives same key.
    var key2b = spf.key(obj2);
    expect(key2a).toEqual(key2b);
    // First and second keys are different.
    expect(key1a).not.toEqual(key2a);
    // Multiple calls gives a unique value.
    var keys = [];
    for (var i = 0; i < 100; i++) {
      var key = spf.key({});
      expect(keys).not.toContain(key);
      keys.push(key);
    }
  });

});
