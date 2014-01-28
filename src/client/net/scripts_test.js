/**
 * @fileoverview Tests for script loading functions.
 */

goog.require('spf.net.scripts');


describe('spf.net.scripts', function() {

  beforeEach(function() {
    window['_global_1_'] = undefined;
    window['_global_2_'] = undefined;
    window['_global_3_'] = undefined;
    window['_global_4_'] = undefined;
  });

  it('eval', function() {
    expect(function() { spf.net.scripts.eval(''); }).not.toThrow();
    // Global execution.
    var text = 'var _global_1_ = 1;';
    spf.net.scripts.eval(text);
    expect(window['_global_1_']).toEqual(1);
    // Global execution in strict mode.
    text = '"use strict";';
    text += 'var _global_2_ = 2;';
    spf.net.scripts.eval(text);
    expect(window['_global_2_']).toEqual(2);
    // Recursive global execution;
    text = 'var _global_3_ = 3;';
    text += 'spf.net.scripts.eval("var _global_4_ = 4;");';
    spf.net.scripts.eval(text);
    expect(window['_global_3_']).toEqual(3);
    expect(window['_global_4_']).toEqual(4);
  });

});
