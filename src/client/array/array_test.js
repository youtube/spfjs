/**
 * @fileoverview Tests for array manipulation functions.
 */

goog.require('spf.array');


describe('spf.array', function() {

  describe('each', function() {

    it('handles iteration', function() {
      var s = '';
      var a = ['a', 'b', 'c', 'd'];
      spf.array.each(a, function(val, i, arr) {
        expect(arr).toEqual(a);
        expect(typeof i).toBe('number');
        s += val + i;
      });
      expect(s).toEqual('a0b1c2d3');
    });

    it('handles empty arrays', function() {
      var s = '';
      var a = new Array(100);
      spf.array.each(a, function(val, i, arr) {
        s += i;  // Should never be called.
      });
      expect(s).toEqual('');
    });

    it('handles sparse arrays', function() {
      // Setting values.
      var s = '';
      var a = new Array(100);
      a[25] = 'a';
      a[50] = undefined;
      spf.array.each(a, function(val, i, arr) {
        s += i;
      });
      expect(s).toEqual('2550');
      // Deleting values.
      var s = '';
      var a = ['a', 'b', 'c', 'd'];
      delete a[1];
      delete a[3];
      spf.array.each(a, function(val, i, arr) {
        expect(arr).toEqual(a);
        expect(typeof i).toBe('number');
        s += val + i;
      });
      expect(s).toEqual('a0c2');
    });

  });

  describe('every', function() {

    var cast = function(x) { return !!x; };
    var invert = function(x) { return !x; };

    it('handles testing', function() {
      var a = [true, true, true, true];
      expect(spf.array.every(a, cast)).toBe(true);
      expect(spf.array.every(a, invert)).toBe(false);
      a = [false, false, false, false];
      expect(spf.array.every(a, cast)).toBe(false);
      expect(spf.array.every(a, invert)).toBe(true);
      a = [false, true, false, true];
      expect(spf.array.every(a, cast)).toBe(false);
      expect(spf.array.every(a, invert)).toBe(false);
    });

    it('handles empty arrays', function() {
      var a = new Array(100);
      expect(spf.array.every(a, cast)).toBe(true);
      expect(spf.array.every(a, invert)).toBe(true);
    });

    it('handles sparse arrays', function() {
      // Setting values.
      var a = new Array(100);
      a[25] = true;
      expect(spf.array.every(a, cast)).toBe(true);
      expect(spf.array.every(a, invert)).toBe(false);
      a[50] = false;
      expect(spf.array.every(a, cast)).toBe(false);
      expect(spf.array.every(a, invert)).toBe(false);
      // Deleting values.
      var a = [true, true, true, true];
      delete a[1];
      delete a[3];
      expect(spf.array.every(a, cast)).toBe(true);
      expect(spf.array.every(a, invert)).toBe(false);
    });

  });

  describe('map', function() {

    var square = function(x) { return x * x; };

    it('handles mapping', function() {
      var a = [0, 1, 2, 3];
      expect(spf.array.map(a, square)).toEqual([0, 1, 4, 9]);
    });

    it('handles empty arrays', function() {
      var a = new Array(100);
      var b = new Array(100);
      expect(spf.array.map(a, square)).toEqual(b);
    });

    it('handles sparse arrays', function() {
      // Setting values.
      var a = new Array(10);
      a[5] = 5;
      a[9] = 9;
      var res = new Array(10);
      res[5] = 25;
      res[9] = 81;
      expect(spf.array.map(a, square)).toEqual(res);
      // Deleting values.
      a = [0, 1, 2, 3];
      delete a[1];
      delete a[2];
      res = [0, 1, 4, 9]
      delete res[1];
      delete res[2];
      expect(spf.array.map(a, square)).toEqual(res);
    });

  });

  describe('isArray', function() {

    it('evaluates arrays', function() {
      expect(spf.array.isArray([])).toBe(true);
      expect(spf.array.isArray([1, 2, 3])).toBe(true);
      expect(spf.array.isArray(new Array())).toBe(true);
      expect(spf.array.isArray(new Array(100))).toBe(true);
    });

    it('evaluates non-arrays', function() {
      expect(spf.array.isArray()).toBe(false);
      expect(spf.array.isArray(undefined)).toBe(false);
      expect(spf.array.isArray(null)).toBe(false);
      expect(spf.array.isArray(50)).toBe(false);
      expect(spf.array.isArray('foo')).toBe(false);
      expect(spf.array.isArray({})).toBe(false);
      expect(spf.array.isArray({push: 1, slice: 1})).toBe(false);
    });

  });

});
