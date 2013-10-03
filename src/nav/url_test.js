/**
 * @fileoverview Tests for navigation-related URL functions.
 */

goog.require('spf.config');
goog.require('spf.nav.url');


describe('spf.nav.url', function() {

  afterEach(function() {
    spf.config.clear();
  });

  describe('identify', function() {

    it('no identifier', function() {
      spf.config.set('url-identifier', null);
      var url = '/page';
      expect(spf.nav.url.identify(url)).toEqual('/page');
      expect(spf.nav.url.identify(url, 'test')).toEqual('/page');
    });

    it('static identifier', function() {
      spf.config.set('url-identifier', '.spf.json');
      var url = '/page.html';
      expect(spf.nav.url.identify(url)).toEqual('/page.html.spf.json');
      expect(spf.nav.url.identify(url, 'test')).toEqual('/page.html.spf.json');
    });

    it('dynamic identifier', function() {
      spf.config.set('url-identifier', '?spf=__type__');
      var url = '/page';
      expect(spf.nav.url.identify(url)).toEqual('/page?spf=');
      expect(spf.nav.url.identify(url, 'test')).toEqual('/page?spf=test');
      url = '/page?arg=1';
      expect(spf.nav.url.identify(url)).toEqual('/page?arg=1&spf=');
      expect(spf.nav.url.identify(url, 'test')).toEqual('/page?arg=1&spf=test');
    });

  });

});
