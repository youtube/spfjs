// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

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
    spyOn(foo, 'pass').and.callThrough();
    spyOn(foo, 'fail').and.callThrough();
    expect(spf.execute(foo.pass)).toEqual('pass');
    expect(foo.pass).toHaveBeenCalled();
    expect(spf.execute(foo.fail)).toEqual(err);
    expect(foo.fail).toHaveBeenCalled();
  });

});
