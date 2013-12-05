/**
 * @fileoverview Tests for the base SPF functions.
 */

goog.require('spf');


describe('spf', function() {

  var foo = 'top';
  var obj = {foo: 'obj'};
  var create = function(arg1, arg2) {
    return {foo: this.foo, arg1: arg1, arg2: arg2};
  };
  var add = function(var_args) {
    var sum = Number(this) || 0;
    for (var i = 0; i < arguments.length; i++) {
      sum += arguments[i];
    }
    return sum;
  };

  describe('bind', function() {

    it('with this', function() {
      var numberLike = {valueOf: function() { return 1; }};
      expect(spf.bind(add, numberLike)()).toEqual(1);
    });

    it('without this', function() {
      expect(spf.bind(add, null, 1, 2)()).toEqual(3);
    });

    it('persist this', function() {
      var obj1 = {};
      var obj2 = {};
      // Use toBe for exact object matching.
      var check = function() { expect(this).toBe(obj1); };
      var fn = spf.bind(check, obj1);
      fn.call();
      fn.call(obj1);
    });

    it('static args', function() {
      var res = spf.bind(create, obj, 'hot', 'dog')();
      expect(obj.foo).toEqual(res.foo);
      expect(res.arg1).toEqual('hot');
      expect(res.arg2).toEqual('dog');
    });

    it('partial args', function() {
      var res = spf.bind(create, obj, 'hot')('dog');
      expect(obj.foo).toEqual(res.foo);
      expect(res.arg1).toEqual('hot');
      expect(res.arg2).toEqual('dog');
    });

    it('dynamic args', function() {
      var res = spf.bind(create, obj)('hot', 'dog');
      expect(obj.foo).toEqual(res.foo);
      expect(res.arg1).toEqual('hot');
      expect(res.arg2).toEqual('dog');
    });

    it('double chain', function() {
      var res = spf.bind(spf.bind(create, obj, 'hot'), null, 'dog')();
      expect(obj.foo).toEqual(res.foo);
      expect(res.arg1).toEqual('hot');
      expect(res.arg2).toEqual('dog');
    });

  });

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
