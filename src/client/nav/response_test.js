/**
 * @fileoverview Tests for navigation-related response functions.
 */

goog.require('spf');
goog.require('spf.history');
goog.require('spf.nav.response');
goog.require('spf.string');


describe('spf.nav.response', function() {

  describe('parse', function() {

    var begin = '[\r\n';
    var delim = ',\r\n';
    var end = ']\r\n';
    var obj1 = {
      'a': 97,
      'b': 98,
      'c': 99
    };
    var obj2 = {
      'd': 100,
      'e': 101,
      'f': 102
    };

    it('single', function() {
      expect(spf.nav.response.parse('{}')).toEqual({
        parts: [{}],
        extra: ''
      });
      expect(spf.nav.response.parse(JSON.stringify(obj1))).toEqual({
        parts: [obj1],
        extra: ''
      });
    });

    it('multipart whole: begin, end', function() {
      var str = begin +
                end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).not.toThrow();
      expect(parseAsSingle()).toEqual({
        parts: [],
        extra: ''
      });
    });

    it('multipart whole: begin, part, end', function() {
      var str = begin +
                JSON.stringify(obj1) +
                end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).not.toThrow();
      expect(parseAsSingle()).toEqual({
        parts: [obj1],
        extra: ''
      });
    });

    it('multipart whole: begin, part, delim, part, end', function() {
      var str = begin +
                JSON.stringify(obj1) +
                delim +
                JSON.stringify(obj2) +
                end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1, obj2],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).not.toThrow();
      expect(parseAsSingle()).toEqual({
        parts: [obj1, obj2],
        extra: ''
      });
    });

    it('multipart whole: begin, part, delim, ' +
       'part, delim, null, end', function() {
      var str = begin +
                JSON.stringify(obj1) +
                delim +
                JSON.stringify(obj2) +
                delim +
                'null' + end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1, obj2, null],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).not.toThrow();
      expect(parseAsSingle()).toEqual({
        parts: [obj1, obj2, null],
        extra: ''
      });
    });

    it('multipart chunk: begin', function() {
      var str = begin;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: begin, part', function() {
      var str = begin +
                JSON.stringify(obj1);
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: JSON.stringify(obj1)
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: begin, part, delim', function() {
      var str = begin +
                JSON.stringify(obj1) +
                delim;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: part', function() {
      var str = JSON.stringify(obj1);
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: str
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).not.toThrow();  // The chunk is valid JSON.
    });

    it('multipart chunk: part, delim', function() {
      var str = JSON.stringify(obj1) +
                delim;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: part, delim, part', function() {
      var str = JSON.stringify(obj1) +
                delim +
                JSON.stringify(obj2);
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1],
        extra: JSON.stringify(obj2)
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: part, delim, part, delim', function() {
      var str = JSON.stringify(obj1) +
                delim +
                JSON.stringify(obj2) +
                delim;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj1, obj2],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: part, delim, null, end', function() {
      var str = JSON.stringify(obj2) +
                delim +
                'null' +
                end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj2, null],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: part, end', function() {
      var str = JSON.stringify(obj2) +
                end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [obj2],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart chunk: end', function() {
      var str = end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart weird: delim, delim', function() {
      var str = delim + delim;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart weird: begin, delim', function() {
      var str = begin + delim;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart weird: begin, delim, end', function() {
      var str = begin + delim + end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart weird: delim, end', function() {
      var str = delim + end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart weird: begin, begin', function() {
      var str = begin + begin;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: begin
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart weird: end, end', function() {
      var str = end + end;
      var parseAsMultipart = spf.bind(spf.nav.response.parse, null, str, true);
      expect(parseAsMultipart).not.toThrow();
      expect(parseAsMultipart()).toEqual({
        parts: [],
        extra: end
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart last-ditch: part, delim', function() {
      var str = JSON.stringify(obj1) +
                delim;
      var parseAsMultipartLastDitch = spf.bind(spf.nav.response.parse, null,
                                               str, true, true);
      expect(parseAsMultipartLastDitch).not.toThrow();
      expect(parseAsMultipartLastDitch()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart last-ditch: part, semi-delim', function() {
      var str = JSON.stringify(obj1) +
                spf.string.trim(delim);
      var parseAsMultipartLastDitch = spf.bind(spf.nav.response.parse, null,
                                               str, true, true);
      expect(parseAsMultipartLastDitch).not.toThrow();
      expect(parseAsMultipartLastDitch()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart last-ditch: part, end', function() {
      var str = JSON.stringify(obj1) +
                end;
      var parseAsMultipartLastDitch = spf.bind(spf.nav.response.parse, null,
                                               str, true, true);
      expect(parseAsMultipartLastDitch).not.toThrow();
      expect(parseAsMultipartLastDitch()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart last-ditch: part, semi-end', function() {
      var str = JSON.stringify(obj1) +
                spf.string.trim(end);
      var parseAsMultipartLastDitch = spf.bind(spf.nav.response.parse, null,
                                               str, true, true);
      expect(parseAsMultipartLastDitch).not.toThrow();
      expect(parseAsMultipartLastDitch()).toEqual({
        parts: [obj1],
        extra: ''
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).toThrow();
    });

    it('multipart last-ditch: part', function() {
      var str = JSON.stringify(obj1);
      var parseAsMultipartLastDitch = spf.bind(spf.nav.response.parse, null,
                                               str, true, true);
      expect(parseAsMultipartLastDitch).not.toThrow();
      expect(parseAsMultipartLastDitch()).toEqual({
        parts: [],
        extra: str
      });
      var parseAsSingle = spf.bind(spf.nav.response.parse, null, str);
      expect(parseAsSingle).not.toThrow();  // The chunk is valid JSON.
    });

  });

  describe('process', function() {

    var currentUrl = 'http://www.youtube.com/watch?v=1';

    beforeEach(function() {
      spyOn(spf.nav.response, 'getCurrentUrl_').andReturn(currentUrl);
      spyOn(spf.history, 'replace');
    });

    it('navigate: with redirect url', function() {
      var response = { 'url': 'http://www.youtube.com/watch?v=3' };

      spf.nav.response.process('/watch?v=2', response, null, true);
      expect(spf.history.replace).toHaveBeenCalledWith(
          response['url'], null, false, true);
    });

    it('navigate: with no redirect url', function() {
      var response = {};

      spf.nav.response.process('/watch?v=2', response, null, true);
      expect(spf.history.replace).not.toHaveBeenCalled();
    });

    it('load: with redirect url', function() {
      var response = { 'url': 'http://www.youtube.com/watch?v=3' };

      spf.nav.response.process('/watch?v=2', response, null, false);
      expect(spf.history.replace).not.toHaveBeenCalled();
    });
  });

});
