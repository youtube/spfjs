/**
 * @fileoverview Tests for navigation-related request functions.
 */

goog.require('spf');
goog.require('spf.cache');
goog.require('spf.nav.request');
goog.require('spf.nav.url');
goog.require('spf.net.xhr');
goog.require('spf.string');


describe('spf.nav.request', function() {

  var MOCK_DELAY = 10;
  var options;
  var createFakeRegularXHR = function(xhrText, isMultipart) {
    var fakeXHR = {
      responseText: xhrText,
      getResponseHeader: function(h) {
        return (h == 'X-SPF-Response-Type' && isMultipart) ? 'multipart' : '';
      }
    };
    var callOnHeaders = function(opts) {
      opts.onHeaders(fakeXHR);
    };
    var callOnDoneDelayed = function(opts) {
      setTimeout(function() {
        opts.onDone(fakeXHR);
      }, MOCK_DELAY);
    };
    return function(xhrUrl, xhrOptions) {
      callOnHeaders(xhrOptions);
      callOnDoneDelayed(xhrOptions);
    };
  };
  var createFakeChunkedXHR = function(xhrText, numChunks, isMultipart) {
    var fakeXHR = {
      responseText: xhrText,
      getResponseHeader: function(h) {
        return (h == 'X-SPF-Response-Type' && isMultipart) ? 'multipart' : '';
      }
    };
    var callOnHeaders = function(opts) {
      opts.onHeaders(fakeXHR);
    };
    var callOnChunkDelayed = function(opts, chunk, num) {
      setTimeout(function() {
        opts.onChunk(fakeXHR, chunk);
      }, MOCK_DELAY * num);
    };
    var callOnDoneDelayed = function(opts) {
      setTimeout(function() {
        opts.onDone(fakeXHR);
      }, MOCK_DELAY * (1 + numChunks));
    };
    return function(xhrUrl, xhrOptions) {
      callOnHeaders(xhrOptions);
      var l = Math.ceil(xhrText.length / numChunks);
      for (var i = 0; i < xhrText.length; i += l) {
        var chunk = xhrText.substring(i, (i + l));
        callOnChunkDelayed(xhrOptions, chunk, (1 + (i / l)));
      }
      callOnDoneDelayed(xhrOptions);
    };
  };


  beforeEach(function(argument) {
    jasmine.Clock.useMock();
    options = {
      onPart: jasmine.createSpy('onPart'),
      onError: jasmine.createSpy('onError'),
      onSuccess: jasmine.createSpy('onSuccess')
    };
    this.addMatchers({
      toEqualObjectIgnoringKeys: function(expected, ignore) {
        var actualCopy = JSON.parse(JSON.stringify(this.actual));
        var expectedCopy = JSON.parse(JSON.stringify(expected));
        for (var i = 0; i < ignore.length; i++) {
          delete actualCopy[ignore[i]];
          delete expectedCopy[ignore[i]];
        }
        var thisCopy = {};
        for (var k in this) {
          thisCopy[k] = this[k];
        }
        thisCopy.actual = actualCopy;
        return jasmine.Matchers.prototype.toEqual.call(thisCopy, expectedCopy);
      }
    });
  });


  afterEach(function() {
    spf.cache.clear();
  });


  describe('send', function() {


    it('cache: single', function() {
      var url = '/page';
      var res = {'foo': 'FOO', 'bar': 'BAR'};
      var absoluteUrl = spf.nav.url.absolute(url);
      var requestUrl = spf.nav.url.identify(absoluteUrl, options.type);
      spf.cache.set(requestUrl, res);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(0);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('cache: multipart', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var absoluteUrl = spf.nav.url.absolute(url);
      var requestUrl = spf.nav.url.identify(absoluteUrl, options.type);
      spf.cache.set(requestUrl, res);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('regular: single', function() {
      var url = '/page';
      var res = {'foo': 'FOO', 'bar': 'BAR'};
      var text = '{"foo": "FOO", "bar": "BAR"}';
      var fake = createFakeRegularXHR(text);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(0);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('regular: single sent as multipart', function() {
      var url = '/page';
      var res = {'foo': 'FOO', 'bar': 'BAR'};
      var text = '{"foo": "FOO", "bar": "BAR"}';
      var fake = createFakeRegularXHR(text, true);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(0);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('regular: multipart', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[\r\n{"foo": "FOO"},\r\n{"bar": "BAR"}]\r\n';
      var fake = createFakeRegularXHR(text, true);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('regular: multipart sent as single', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[\r\n{"foo": "FOO"},\r\n{"bar": "BAR"}]\r\n';
      var fake = createFakeRegularXHR(text);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('regular: multipart missing delimiters', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[{"foo": "FOO"}, {"bar": "BAR"}]';
      var fake = createFakeRegularXHR(text, true);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('regular: multipart missing delimiters sent as single', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
     var text = '[{"foo": "FOO"}, {"bar": "BAR"}]';
      var fake = createFakeRegularXHR(text);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick(MOCK_DELAY + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('chunked: single', function() {
      var url = '/page';
      var res = {'foo': 'FOO', 'bar': 'BAR'};
      var text = '{"foo": "FOO", "bar": "BAR"}';
      var fake = createFakeChunkedXHR(text, 3);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick((MOCK_DELAY * 4) + 1);

      expect(options.onPart.calls.length).toEqual(0);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('chunked: single sent as multipart', function() {
      var url = '/page';
      var res = {'foo': 'FOO', 'bar': 'BAR'};
      var text = '{"foo": "FOO", "bar": "BAR"}';
      var fake = createFakeChunkedXHR(text, 3, true);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick((MOCK_DELAY * 4) + 1);

      expect(options.onPart.calls.length).toEqual(0);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('chunked: multipart', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[\r\n{"foo": "FOO"},\r\n{"bar": "BAR"}]\r\n';
      var fake = createFakeChunkedXHR(text, 3, true);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick((MOCK_DELAY * 4) + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('chunked: multipart sent as single', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[\r\n{"foo": "FOO"},\r\n{"bar": "BAR"}]\r\n';
      var fake = createFakeChunkedXHR(text, 3);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick((MOCK_DELAY * 4) + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('chunked: multipart missing delimiters', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[{"foo": "FOO"}, {"bar": "BAR"}]';
      var fake = createFakeChunkedXHR(text, 3, true);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick((MOCK_DELAY * 4) + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


    it('chunked: multipart missing delimiters sent as single', function() {
      var url = '/page';
      var res = {
        parts: [{'foo': 'FOO'}, {'bar': 'BAR'}],
        type: 'multipart'
      };
      var text = '[{"foo": "FOO"}, {"bar": "BAR"}]';
      var fake = createFakeChunkedXHR(text, 3);
      spf.net.xhr.get = jasmine.createSpy('xhr.get').andCallFake(fake);

      spf.nav.request.send(url, options);

      // Simulate waiting for the response.
      jasmine.Clock.tick((MOCK_DELAY * 4) + 1);

      expect(options.onPart.calls.length).toEqual(2);
      expect(options.onSuccess.calls.length).toEqual(1);
      expect(options.onError.calls.length).toEqual(0);
      var onSuccessArgs = options.onSuccess.mostRecentCall.args;
      expect(onSuccessArgs[0]).toEqual(url);
      expect(onSuccessArgs[1]).toEqualObjectIgnoringKeys(res, ['timing']);
    });


  });


});
