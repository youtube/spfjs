// Copyright 2013 Google Inc. All rights reserved.
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
goog.require('spf.testing.dom');


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

    it('handles strings in single responses', function() {
      var response = {
        head: '<script src=foo.js name=foo async></script>' +
                '<link rel=stylesheet href=foo.css name=foo>',
        body: {
          id: '<script name="quatre">window.foo = 4</script>' +
                '<style name="quatre">.foo { color: red }</style>'
        },
        foot: '<script src=bar.js name=bar></script>' +
                '<link rel=stylesheet href=bar.css name=bar>'
      };
      var expected = {
        head: {
          scripts: [{url: 'foo.js', text: '', name: 'foo', async: true}],
          styles: [{url: 'foo.css', text: '', name: 'foo'}],
          links: [],
          html: ''
        },
        body: {
          id: {
            scripts: [
              {url: '', text: 'window.foo = 4', name: 'quatre', async: false}
            ],
            styles: [{url: '', text: '.foo { color: red }', name: 'quatre'}],
            links: [],
            html: ''
          }
        },
        foot: {
          scripts: [{url: 'bar.js', text: '', name: 'bar', async: false}],
          styles: [{url: 'bar.css', text: '', name: 'bar'}],
          links: [],
          html: ''
        }
      };
      var result = spf.nav.response.extract(response);
      // Jasmine 2's toEqual has problems comparing prototype-based properties
      // with non-prototype ones.  Round-trip through JSON to work around it.
      result = JSON.parse(JSON.stringify(result));
      expect(result).toEqual(expected);
    });

    it('handles strings in multipart responses', function() {
      var response = [
        {
          head: '<script src=foo.js name=foo async></script>' +
                  '<link rel=stylesheet href=foo.css name=foo>'
        },
        {
          body: {
            id: '<script name="quatre">window.foo = 4</script>' +
                  '<style name="quatre">.foo { color: red }</style>'
          }
        },
        {
          foot: '<script src=bar.js name=bar></script>' +
                  '<link rel=stylesheet href=bar.css name=bar>'
        }
      ];
      var expected = [
        {
          head: {
            scripts: [{url: 'foo.js', text: '', name: 'foo', async: true}],
            styles: [{url: 'foo.css', text: '', name: 'foo'}],
            links: [],
            html: ''
          }
        },
        {
          body: {
            id: {
              scripts: [
                {url: '', text: 'window.foo = 4', name: 'quatre', async: false}
              ],
              styles: [{url: '', text: '.foo { color: red }', name: 'quatre'}],
              links: [],
              html: ''
            }
          }
        },
        {
          foot: {
            scripts: [{url: 'bar.js', text: '', name: 'bar', async: false}],
            styles: [{url: 'bar.css', text: '', name: 'bar'}],
            links: [],
            html: ''
          }
        }
      ];
      var result = spf.nav.response.extract(response);
      // Jasmine 2's toEqual has problems comparing prototype-based properties
      // with non-prototype ones.  Round-trip through JSON to work around it.
      result = JSON.parse(JSON.stringify(result));
      expect(result).toEqual(expected);
    });

    it('handles objects in single responses', function() {
      var response = {
        head: {
          scripts: [{url: 'foo.js', name: 'foo', async: true}],
          styles: [{url: 'foo.css', name: 'foo'}]
        },
        body: {
          id: {
            scripts: [{text: 'window.foo = 4', name: 'quatre'}],
            styles: [{text: '.foo { color: red }', name: 'quatre'}]
          }
        },
        foot: {
          scripts: [{url: 'bar.js', name: 'bar'}],
          styles: [{url: 'bar.css', name: 'bar'}]
        }
      };
      var expected = {
        head: {
          scripts: [{url: 'foo.js', text: '', name: 'foo', async: true}],
          styles: [{url: 'foo.css', text: '', name: 'foo'}],
          links: [],
          html: ''
        },
        body: {
          id: {
            scripts: [
              {url: '', text: 'window.foo = 4', name: 'quatre', async: false}
            ],
            styles: [{url: '', text: '.foo { color: red }', name: 'quatre'}],
            links: [],
            html: ''
          }
        },
        foot: {
          scripts: [{url: 'bar.js', text: '', name: 'bar', async: false}],
          styles: [{url: 'bar.css', text: '', name: 'bar'}],
          links: [],
          html: ''
        }
      };
      var result = spf.nav.response.extract(response);
      // Jasmine 2's toEqual has problems comparing prototype-based properties
      // with non-prototype ones.  Round-trip through JSON to work around it.
      result = JSON.parse(JSON.stringify(result));
      expect(result).toEqual(expected);
    });

    it('handles objects in multipart responses', function() {
      var response = [
        {
          head: {
            scripts: [{url: 'foo.js', name: 'foo', async: true}],
            styles: [{url: 'foo.css', name: 'foo'}]
          }
        },
        {
          body: {
            id: {
              scripts: [{text: 'window.foo = 4', name: 'quatre'}],
              styles: [{text: '.foo { color: red }', name: 'quatre'}]
            }
          }
        },
        {
          foot: {
            scripts: [{url: 'bar.js', name: 'bar'}],
            styles: [{url: 'bar.css', name: 'bar'}]
          }
        }
      ];
      var expected = [
        {
          head: {
            scripts: [{url: 'foo.js', text: '', name: 'foo', async: true}],
            styles: [{url: 'foo.css', text: '', name: 'foo'}],
            links: [],
            html: ''
          }
        },
        {
          body: {
            id: {
              scripts: [
                {url: '', text: 'window.foo = 4', name: 'quatre', async: false}
              ],
              styles: [{url: '', text: '.foo { color: red }', name: 'quatre'}],
              links: [],
              html: ''
            }
          }
        },
        {
          foot: {
            scripts: [{url: 'bar.js', text: '', name: 'bar', async: false}],
            styles: [{url: 'bar.css', text: '', name: 'bar'}],
            links: [],
            html: ''
          }
        }
      ];
      var result = spf.nav.response.extract(response);
      // Jasmine 2's toEqual has problems comparing prototype-based properties
      // with non-prototype ones.  Round-trip through JSON to work around it.
      result = JSON.parse(JSON.stringify(result));
      expect(result).toEqual(expected);
    });

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
        '<link rel = "stylesheet" href = "foo.css" name = "foo">' +
        // HTML5 style.
        '<link rel=stylesheet href=bar.css name=bar>' +
        // HTML5 style with spaces.
        '<link rel = stylesheet  href = bar.css name = bar>' +
        // Single quotes.
        "<link rel='stylesheet' href='baz.css' name='baz'>" +
        // Single quotes with spaces.
        "<link rel = 'stylesheet' href = 'baz.css' name = 'baz'>" +
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

    it('inject only script type javascript', function() {
      var string = '<head>' +
        '<script src="bar.js" name="bar" async></script>' +
        '<script name="quatre">window.foo = 1</script>' +
        '<script type="application/javascript">window.foo = 2</script>' +
        '<script>window.foo = 3</script>' +
        '<script type="text/javascript">window.foo = 4</script>' +
        '<script type="application/ecmascript">window.foo = 5</script>' +
        '<script type="text/ecmascript">window.foo = 6</script>' +
        '<script type="application/x-javascript">window.foo = 7</script>' +
        '<script type="application/json">{"foo":"bar"}</script>' +
        '</head>';
      var expected = {
        scripts: [
          {url: 'bar.js', text: '', name: 'bar', async: true},
          {url: '', text: 'window.foo = 1', name: 'quatre', async: false},
          {url: '', text: 'window.foo = 2', name: '', async: false},
          {url: '', text: 'window.foo = 3', name: '', async: false},
          {url: '', text: 'window.foo = 4', name: '', async: false},
          {url: '', text: 'window.foo = 5', name: '', async: false},
          {url: '', text: 'window.foo = 6', name: '', async: false},
          {url: '', text: 'window.foo = 7', name: '', async: false}
        ],
        html: '<head>' +
          '<script type="application/json">{"foo":"bar"}</script>' +
          '</head>'
      };

      var result = spf.nav.response.extract_(string);
      expect(result.scripts).toEqual(expected.scripts);
      expect(result.html).toBe(expected.html);
    });

    it('inject only style type css', function() {
      var string = '<head>' +
        '<style name="quatre">.foo { color: red }</style>' +
        '<style name="vingt" type="text/css">.foo { color: blue }</style>' +
        '<style name="dix" type="text/less">.foo { color: green }</style>' +
        '</head>';
        var expected = {
          styles: [
            {url: '', text: '.foo { color: red }', name: 'quatre'},
            {url: '', text: '.foo { color: blue }', name: 'vingt'}
          ],
          html: '<head>' +
            '<style name="dix" type="text/less">.foo { color: green }</style>' +
            '</head>'
        };

        var result = spf.nav.response.extract_(string);
        expect(result.styles).toEqual(expected.styles);
        expect(result.html).toBe(expected.html);
    });
  });


  describe('process', function() {

    var currentUrl = 'http://www.youtube.com/watch?v=1';

    beforeEach(function() {
      spyOn(spf.nav.response, 'getCurrentUrl_').and.returnValue(currentUrl);
      spyOn(spf.history, 'replace');
    });

    afterEach(function() {
      spf.testing.dom.removeAllElements();
    });

    it('sets attributes from "attr" field', function() {
      var foo = spf.testing.dom.createElement('foo', undefined,
          {'class': 'first'});
      var bar = spf.testing.dom.createElement('bar', undefined, {'dir': 'ltr'});

      var info = { type: 'navigate' };
      var response = {
        'attr': {
          'foo': { 'dir': 'rtl', 'class': 'last' },
          'bar': { 'dir': 'rtl', 'class': 'last' }
        }
      };

      spf.nav.response.process('/page', response, info);
      expect(foo.className).toEqual('last');
      expect(foo.getAttribute('dir')).toEqual('rtl');
      expect(bar.className).toEqual('last');
      expect(bar.getAttribute('dir')).toEqual('rtl');
    });

    it('sets html from "body" field', function() {
      var foo = spf.testing.dom.createElement('foo', 'one');
      var bar = spf.testing.dom.createElement('bar');

      var info = { type: 'navigate' };
      var response = {
        'body': {
          'foo': 'two',
          'bar': 'two'
        }
      };

      spf.nav.response.process('/page', response, info);
      expect(foo.innerHTML).toEqual('two');
      expect(bar.innerHTML).toEqual('two');
    });

    it('updates history for navigate with redirect url', function() {
      var info = { type: 'navigate' };
      var response = { 'url': 'http://www.youtube.com/watch?v=3' };

      spf.nav.response.process('/watch?v=2', response, info);
      expect(spf.history.replace).toHaveBeenCalledWith(response['url']);
    });

    it('does not update history for navigate without redirect url', function() {
      var info = { type: 'navigate' };
      var response = {};

      spf.nav.response.process('/watch?v=2', response, info);
      expect(spf.history.replace).not.toHaveBeenCalled();
    });

    it('does not update history for load with redirect url', function() {
      var info = { type: 'load' };
      var response = { 'url': 'http://www.youtube.com/watch?v=3' };

      spf.nav.response.process('/watch?v=2', response, info);
      expect(spf.history.replace).not.toHaveBeenCalled();
    });

  });


});
