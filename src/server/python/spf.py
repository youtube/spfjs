# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

"""Utilities to facilitate handling SPF requests and responses."""

__author__ = 'nicksay@google.com (Alex Nicksay)'


# pylint: disable=too-few-public-methods
class Header(str):
    """String subclass representing a HTTP header."""

    def cgi_env_var(self):
        """Formats the header as a CGI environment variable.

        See https://www.python.org/dev/peps/pep-0333/#environ-variables.
        """
        return 'HTTP_' + self.replace('-', '_').upper()


# pylint: disable=too-few-public-methods
class HeaderIn(object):
    """Enum-like class for incoming HTTP header keys."""
    PREVIOUS = Header('X-SPF-Previous')
    REFERER = Header('X-SPF-Referer')
    REQUEST = Header('X-SPF-Request')


# pylint: disable=too-few-public-methods
class HeaderOut(object):
    """Enum-like class for outgoing HTTP header keys."""
    RESPONSE_TYPE = Header('X-SPF-Response-Type')


# pylint: disable=too-few-public-methods
class UrlIdentifier(object):
    """Enum-like class for the URL identifier."""
    PARAM = 'spf'


# pylint: disable=too-few-public-methods
class RequestType(object):
    """Enum-like class for request types, as sent with the URL identifier."""
    NAVIGATE = 'navigate'
    NAVIGATE_BACK = 'navigate-back'
    NAVIGATE_FORWARD = 'navigate-forward'
    PREFETCH = 'prefetch'
    LOAD = 'load'


# pylint: disable=too-few-public-methods
class ResponseKey(object):
    """Enum-like class for response object keys."""
    TITLE = 'title'
    URL = 'url'
    HEAD = 'head'
    FOOT = 'foot'
    ATTR = 'attr'
    BODY = 'body'
    NAME = 'name'
    REDIRECT = 'redirect'


# pylint: disable=too-few-public-methods
class ResponseType(object):
    """Enum-like class for response types, for the outgoing HTTP header."""
    MULTIPART = 'multipart'


# pylint: disable=too-few-public-methods
class MultipartToken(object):
    """Enum-like class for the tokens used in multipart respones."""
    BEGIN = '[\r\n'
    DELIMITER = ',\r\n'
    END = ']\r\n'


def hashcode(string):
    """A string hash function for compatibility with spf.string.hashCode.

    This function is similar to java.lang.String.hashCode().
    The hash code for a string is computed as
    s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
    where s[i] is the ith character of the string and n is the length of
    the string. We mod the result to make it between 0 (inclusive) and 2^32
    (exclusive).

    Args:
        string: A string.

    Returns:
        Integer hash value for the string, between 0 (inclusive) and 2^32
        (exclusive).  The empty string and None return 0.
    """
    if string is None:
        string = ''
    result = 0
    max_value = 2**32
    for char in string:
        result = (31 * result) + ord(char)
        result %= max_value
    return result
