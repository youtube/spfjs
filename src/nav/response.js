/**
 * @fileoverview Navigation-related response functions.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */

goog.provide('spf.nav.response');

goog.require('spf');
goog.require('spf.string');


/**
 * Parses text for an SPF response.  If {@code opt_multipart} is true, attempts
 * to parse the text for one or more (in)complete multipart SPF responses.
 *
 * @param {string} text Text to parse.
 * @param {boolean=} opt_multipart Whether to attempt to parse the text for
 *     one or more multipart SPF response sections.
 * @throws {Error} If the {@code text} contains invalid JSON.
 * @return {{parts: Array.<spf.SingleResponse>, extra: string}}
 */
spf.nav.response.parse = function(text, opt_multipart) {
  if (opt_multipart) {
    var beginToken = spf.nav.response.Token.BEGIN;
    var delimToken = spf.nav.response.Token.DELIMITER;
    var endToken = spf.nav.response.Token.END;
    var parts = [];
    var chunk;
    var start = 0;
    var finish = text.indexOf(beginToken, start);
    if (finish > -1) {
      start = finish + beginToken.length;
    }
    while ((finish = text.indexOf(delimToken, start)) > -1) {
      chunk = spf.string.trim(text.substring(start, finish));
      start = finish + delimToken.length;
      if (chunk) {
        parts.push(spf.nav.response.parse_(chunk));
      }
    }
    finish = text.indexOf(endToken, start);
    if (finish > -1) {
      chunk = spf.string.trim(text.substring(start, finish));
      start = finish + endToken.length;
      if (chunk) {
        parts.push(spf.nav.response.parse_(chunk));
      }
    }
    var extra = '';
    if (text.length > start) {
      extra = text.substring(start);
    }
    return {
      parts: /** @type {Array.<spf.SingleResponse>} */(parts),
      extra: extra
    };
  } else {
    var response = spf.nav.response.parse_(text);
    var parts;
    if (typeof response.length == 'number') {
      parts = response;
    } else {
      parts = [response];
    }
    return {
      parts: /** @type {Array.<spf.SingleResponse>} */(parts),
      extra: ''
    };
  }
};


/**
 * @param {string} text JSON response text to parse.
 * @throws {Error} If the {@code text} is invalid JSON.
 * @return {*}
 * @private
 */
spf.nav.response.parse_ = (function() {
  if ('JSON' in window) {
    return function(text) { return JSON.parse(text); };
  } else {
    return function(text) { return eval('(' + text + ')'); };
  }
})();


/**
 * Tokens used when parsing multipart responses.
 * @enum {string}
 */
spf.nav.response.Token = {
  BEGIN: '[\r\n',
  DELIMITER: ',\r\n',
  END: ']\r\n'
};
