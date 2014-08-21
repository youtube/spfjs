// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Tests for navigation-related response functions.
 */

goog.require('spf');
goog.require('spf.dom');
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


  describe('extract', function() {

    it('parses external scripts', function() {
      var string = '<head>' +
        // HTML4 style.
        '<script src="foo.js" name="foo"></script>' +
        // HTML4 style with spaces.
        '<script src = "foo.js" name = "foo"></script>' +
        // HTML5 style.
        '<script src=bar.js name=bar async></script>' +
        // HTML5 style with spaces.
        '<script src = bar.js name = bar async></script>' +
        // Single quotes.
        "<script src='baz.js' name='baz'></script>" +
        // Single quotes with spaces.
        "<script src = 'baz.js' name = 'baz'></script>" +
        // HTML4 style with async attribute.
        '<script src="qux.js" name="qux" async="async"></script>' +
        '</head>';
      var expected = {
        scripts: [
          {url: 'foo.js', text: '', name: 'foo', async: false},
          {url: 'foo.js', text: '', name: 'foo', async: false},
          {url: 'bar.js', text: '', name: 'bar', async: true},
          {url: 'bar.js', text: '', name: 'bar', async: true},
          {url: 'baz.js', text: '', name: 'baz', async: false},
          {url: 'baz.js', text: '', name: 'baz', async: false},
          {url: 'qux.js', text: '', name: 'qux', async: true}
        ],
        html: '<head></head>'
      };

      var result = spf.nav.response.extract_(string);
      expect(result.scripts).toEqual(expected.scripts);
      expect(result.html).toEqual(expected.html);
    });

    it('parses inline scripts', function() {
      var string = '<head>' +
        '<script name="quatre">window.foo = 4</script>' +
        '<script name="vingt">window.foo *= 20</script>' +
        '<script name="dix">window.foo += 10</script>' +
        '</head>';
      var expected = {
        scripts: [
          {url: '', text: 'window.foo = 4', name: 'quatre', async: false},
          {url: '', text: 'window.foo *= 20', name: 'vingt', async: false},
          {url: '', text: 'window.foo += 10', name: 'dix', async: false}
        ],
        html: '<head></head>'
      };
      var result = spf.nav.response.extract_(string);
      expect(result.scripts).toEqual(expected.scripts);
      expect(result.html).toEqual(expected.html);
    });

    it('parses external styles', function() {
      var string = '<head>' +
        // HTML4 style.
        '<link rel="stylesheet" href="foo.css" name="foo">' +
        // HTML4 style with spaces.
        '<link rel="stylesheet" href = "foo.css" name = "foo">' +
        // HTML5 style.
        '<link rel="stylesheet" href=bar.css name=bar>' +
        // HTML5 style with spaces.
        '<link rel="stylesheet" href = bar.css name = bar>' +
        // Single quotes.
        "<link rel='stylesheet' href='baz.css' name='baz'>" +
        // Single quotes with spaces.
        "<link rel='stylesheet' href = 'baz.css' name = 'baz'>" +
        // Non-matching HTML4 style.
        '<link href="qux.css">' +
        // Non-matching HTML5 style.
        '<link rel=other href=qux.css>' +
        '</head>';
      var expected = {
        styles: [
          {url: 'foo.css', text: '', name: 'foo'},
          {url: 'foo.css', text: '', name: 'foo'},
          {url: 'bar.css', text: '', name: 'bar'},
          {url: 'bar.css', text: '', name: 'bar'},
          {url: 'baz.css', text: '', name: 'baz'},
          {url: 'baz.css', text: '', name: 'baz'}
        ],
        html: '<head><link href="qux.css"><link rel=other href=qux.css></head>'
      };

      var result = spf.nav.response.extract_(string);
      expect(result.styles).toEqual(expected.styles);
      expect(result.html).toBe(expected.html);
    });

    it('parses inline styles', function() {
      var string = '<head>' +
        '<style name="quatre">.foo { color: red }</style>' +
        '<style name="vingt">.foo { color: blue }</style>' +
        '<style name="dix">.foo { color: green }</style>' +
        '</head>';
      var expected = {
        styles: [
          {url: '', text: '.foo { color: red }', name: 'quatre'},
          {url: '', text: '.foo { color: blue }', name: 'vingt'},
          {url: '', text: '.foo { color: green }', name: 'dix'}
        ],
        html: '<head></head>'
      };

      var result = spf.nav.response.extract_(string);
      expect(result.styles).toEqual(expected.styles);
      expect(result.html).toBe(expected.html);
    });

  });


  describe('parseScripts', function() {

    it('parses external scripts', function() {
      var string = '<head>' +
        // HTML4 style.
        '<script src="foo.js" name="foo"></script>' +
        // NOTE: HTML4 style with spaces not supported.
        // NOTE: HTML5 style not supported.
        // NOTE: HTML5 style with spaces not supported.
        // NOTE: Single quotes not supported.
        // NOTE: Single quotes with spaces not supported.
        // HTML4 style with async attribute.
        '<script src="qux.js" name="qux" async="async"></script>' +
        '</head>';
      var expected = {
        scripts: [
          {url: 'foo.js', text: '', name: 'foo', async: false},
          {url: 'qux.js', text: '', name: 'qux', async: true}
        ],
        html: '<head></head>'
      };

      var result = spf.nav.response.parseScripts_(string);
      expect(result.scripts).toEqual(expected.scripts);
      expect(result.html).toEqual(expected.html);
    });

    it('parses inline scripts', function() {
      var string = '<head>' +
        '<script name="quatre">window.foo = 4</script>' +
        '<script name="vingt">window.foo *= 20</script>' +
        '<script name="dix">window.foo += 10</script>' +
        '</head>';
      var expected = {
        scripts: [
          {url: '', text: 'window.foo = 4', name: 'quatre', async: false},
          {url: '', text: 'window.foo *= 20', name: 'vingt', async: false},
          {url: '', text: 'window.foo += 10', name: 'dix', async: false}
        ],
        html: '<head></head>'
      };
      var result = spf.nav.response.parseScripts_(string);
      expect(result.scripts).toEqual(expected.scripts);
      expect(result.html).toEqual(expected.html);
    });

  });


  describe('parseStyles', function() {

    it('parses external styles', function() {
      var string = '<head>' +
        // HTML4 style.
        '<link rel="stylesheet" href="foo.css" name="foo">' +
        // NOTE: HTML4 style with spaces not supported.
        // NOTE: HTML5 style not supported
        // NOTE: Single quotes not supported.
        // NOTE: Single quotes with spaces.
        // Non-matching HTML4 style.
        '<link href="qux.css">' +
        // Non-matching HTML5 style.
        '<link rel=other href=qux.css>' +
        '</head>';
      var expected = {
        styles: [
          {url: 'foo.css', text: '', name: 'foo'}
        ],
        html: '<head><link href="qux.css"><link rel=other href=qux.css></head>'
      };

      var result = spf.nav.response.parseStyles_(string);
      expect(result.styles).toEqual(expected.styles);
      expect(result.html).toBe(expected.html);
    });

    it('parses inline styles', function() {
      // NOTE: name attributes not supported.
      var string = '<head>' +
        '<style>.foo { color: red }</style>' +
        '<style>.foo { color: blue }</style>' +
        '<style>.foo { color: green }</style>' +
        '</head>';
      var expected = {
        styles: [
          {url: '', text: '.foo { color: red }', name: ''},
          {url: '', text: '.foo { color: blue }', name: ''},
          {url: '', text: '.foo { color: green }', name: ''}
        ],
        html: '<head></head>'
      };

      var result = spf.nav.response.parseStyles_(string);
      expect(result.styles).toEqual(expected.styles);
      expect(result.html).toBe(expected.html);
    });

  });


  describe('process', function() {

    var currentUrl = 'http://www.youtube.com/watch?v=1';
    var elements = {};

    var FakeElement = function(initialHTML, initialAttributes) {
      this.attributes = {};
      this.className = '';
      this.innerHTML = initialHTML || '';
      if (initialAttributes) {
        spf.dom.setAttributes(this, initialAttributes);
      }
    };
    FakeElement.prototype.getAttribute = function(name) {
      return this.attributes[name];
    };
    FakeElement.prototype.setAttribute = function(name, value) {
      this.attributes[name] = value;
    };

    beforeEach(function() {
      spyOn(spf.nav.response, 'getCurrentUrl_').andReturn(currentUrl);
      spyOn(spf.history, 'replace');
      spyOn(document, 'getElementById').andCallFake(function(id) {
        return elements[id];
      });
    });

    afterEach(function() {
      elements = {};
    });

    it('sets attributes from "attr" field', function() {
      elements = {
        'foo': new FakeElement({'class': 'first'}),
        'bar': new FakeElement({'dir': 'ltr'})
      };

      var response = {
        'attr': {
          'foo': { 'dir': 'rtl', 'class': 'last' },
          'bar': { 'dir': 'rtl', 'class': 'last' }
        }
      };

      spf.nav.response.process('/page', response, null, true);
      expect(elements['foo'].className).toEqual('last');
      expect(elements['foo'].attributes['dir']).toEqual('rtl');
      expect(elements['bar'].className).toEqual('last');
      expect(elements['bar'].attributes['dir']).toEqual('rtl');
    });

    it('sets html from "body" field', function() {
      elements = {
        'foo': new FakeElement('one'),
        'bar': new FakeElement()
      };

      var response = {
        'body': {
          'foo': 'two',
          'bar': 'two'
        }
      };

      spf.nav.response.process('/page', response, null, true);
      expect(elements['foo'].innerHTML).toEqual('two');
      expect(elements['foo'].innerHTML).toEqual('two');
    });

    it('updates history for navigate with redirect url', function() {
      var response = { 'url': 'http://www.youtube.com/watch?v=3' };

      spf.nav.response.process('/watch?v=2', response, null, true);
      expect(spf.history.replace).toHaveBeenCalledWith(
          response['url'], null, false, true);
    });

    it('does not update history for navigate without redirect url', function() {
      var response = {};

      spf.nav.response.process('/watch?v=2', response, null, true);
      expect(spf.history.replace).not.toHaveBeenCalled();
    });

    it('does not update history for load with redirect url', function() {
      var response = { 'url': 'http://www.youtube.com/watch?v=3' };

      spf.nav.response.process('/watch?v=2', response, null, false);
      expect(spf.history.replace).not.toHaveBeenCalled();
    });

  });


});
