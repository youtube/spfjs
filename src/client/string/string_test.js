// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for string manipulation functions.
 */

goog.require('spf.string');


describe('spf.string', function() {

  it('contains', function() {
    // Character matching.
    expect(spf.string.contains('/path?query=arg', '?')).toBe(true);
    expect(spf.string.contains('/path?query=arg', '#')).toBe(false);
    // Substring matching.
    expect(spf.string.contains('/path?query=arg', 'query')).toBe(true);
    expect(spf.string.contains('/path?query=arg', 'hash')).toBe(false);
    // Full matching.
    expect(spf.string.contains('attr="value"', 'attr="value"')).toBe(true);
    expect(spf.string.contains('attr="value"', 'attr="other"')).toBe(false);
  });

  it('startsWith', function() {
    // Character matching.
    expect(spf.string.startsWith('?query=arg', '?')).toBe(true);
    expect(spf.string.startsWith('?query=arg', '#')).toBe(false);
    // Substring matching.
    expect(spf.string.startsWith('?query=arg', '?query')).toBe(true);
    expect(spf.string.startsWith('?query=arg', '?other')).toBe(false);
    // Full matching.
    expect(spf.string.startsWith('attr="value"', 'attr="value"')).toBe(true);
    expect(spf.string.startsWith('attr="value"', 'attr="other"')).toBe(false);
    // Offset matching.
    expect(spf.string.startsWith('"use strict";', 'use strict', 1)).toBe(true);
    expect(spf.string.startsWith('"use strict";', 'use strict')).toBe(false);
  });

  it('endsWith', function() {
    // Character matching.
    expect(spf.string.endsWith('file.js', 's')).toBe(true);
    expect(spf.string.endsWith('file.js', 't')).toBe(false);
    // Substring matching.
    expect(spf.string.endsWith('file.js', '.js')).toBe(true);
    expect(spf.string.endsWith('file.js', '.txt')).toBe(false);
    // Substring matching.
    expect(spf.string.endsWith('file.js', 'file.js')).toBe(true);
    expect(spf.string.endsWith('file.js', 'file.txt')).toBe(false);
  });

  it('trim', function() {
    // No trimming.
    expect(spf.string.trim('foo bar')).toEqual('foo bar');
    // Trim leading.
    expect(spf.string.trim('    foo bar')).toEqual('foo bar');
    expect(spf.string.trim('\n\nfoo bar')).toEqual('foo bar');
    expect(spf.string.trim('\t\tfoo bar')).toEqual('foo bar');
    expect(spf.string.trim('\r\rfoo bar')).toEqual('foo bar');
    expect(spf.string.trim(' \t \r\n foo bar')).toEqual('foo bar');
    // Trim trailing.
    expect(spf.string.trim('foo bar    ')).toEqual('foo bar');
    expect(spf.string.trim('foo bar\n\n')).toEqual('foo bar');
    expect(spf.string.trim('foo bar\t\t')).toEqual('foo bar');
    expect(spf.string.trim('foo bar\r\r')).toEqual('foo bar');
    expect(spf.string.trim('foo bar \r\n \t ')).toEqual('foo bar');
    // Trim both.
    expect(spf.string.trim('    foo bar    ')).toEqual('foo bar');
    expect(spf.string.trim('\n\nfoo bar\n\n')).toEqual('foo bar');
    expect(spf.string.trim('\t\tfoo bar\t\t')).toEqual('foo bar');
    expect(spf.string.trim('\r\rfoo bar\r\r')).toEqual('foo bar');
    expect(spf.string.trim(' \t \r\n foo bar \r\n \t ')).toEqual('foo bar');
  });

  it('partition', function() {
    // No separator.
    expect(spf.string.partition('foobar', '|')).toEqual(['foobar', '', '']);
    // One separator.
    expect(spf.string.partition('foo|bar', '|')).toEqual(['foo', '|', 'bar']);
    expect(spf.string.partition('|foobar', '|')).toEqual(['', '|', 'foobar']);
    expect(spf.string.partition('foobar|', '|')).toEqual(['foobar', '|', '']);
    // Multiple separators.
    expect(spf.string.partition('foo|bar|one', '|')).toEqual(
        ['foo', '|', 'bar|one']);
    expect(spf.string.partition('|foo|bar|one', '|')).toEqual(
        ['', '|', 'foo|bar|one']);
    expect(spf.string.partition('foo|bar|one|', '|')).toEqual(
        ['foo', '|', 'bar|one|']);
  });

  it('hashcode', function() {
    expect(function() {spf.string.hashcode(null)}).not.toThrow();
    expect(spf.string.hashcode(null)).toEqual(0);
    expect(spf.string.hashcode('')).toEqual(0);
    expect(spf.string.hashcode('foo')).toEqual(101574);
    expect(spf.string.hashcode('\uAAAAfoo')).toEqual(1301670364);
    var repeat = function(n, s) { return (new Array(n + 1)).join(s); };
    expect(spf.string.hashcode(repeat(5, 'a'))).toEqual(92567585);
    expect(spf.string.hashcode(repeat(6, 'a'))).toEqual(2869595232);
    expect(spf.string.hashcode(repeat(7, 'a'))).toEqual(3058106369);
    expect(spf.string.hashcode(repeat(8, 'a'))).toEqual(312017024);
    expect(spf.string.hashcode(repeat(1024, 'a'))).toEqual(2929737728);
  });

  it('toSelectorCase', function() {
    expect(spf.string.toSelectorCase('OneTwoThree')).toEqual('-one-two-three');
    expect(spf.string.toSelectorCase('oneTwoThree')).toEqual('one-two-three');
    expect(spf.string.toSelectorCase('oneTwo')).toEqual('one-two');
    expect(spf.string.toSelectorCase('one')).toEqual('one');
    expect(spf.string.toSelectorCase('one-two')).toEqual('one-two');
    // String object function name.
    expect(spf.string.toSelectorCase('toString')).toEqual('to-string');
  });

  describe('isString', function() {

    it('evaluates strings', function() {
      expect(spf.string.isString('')).toBe(true);
      expect(spf.string.isString('foo')).toBe(true);
      expect(spf.string.isString(new String())).toBe(true);
      expect(spf.string.isString(new String('Foo'))).toBe(true);
    });

    it('evaluates non-strings', function() {
      expect(spf.string.isString()).toBe(false);
      expect(spf.string.isString(undefined)).toBe(false);
      expect(spf.string.isString(null)).toBe(false);
      expect(spf.string.isString(50)).toBe(false);
      expect(spf.string.isString([])).toBe(false);
      expect(spf.string.isString({})).toBe(false);
      expect(spf.string.isString({length: 1})).toBe(false);
    });

  });

});
