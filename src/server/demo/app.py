# Copyright 2012 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

"""Simple demo server app for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'


import json
import math
import random
import time

import spf  # pylint: disable=import-error
import web  # pylint: disable=import-error


# Set up the basic app config.
TEMPLATES = web.template.render('templates/',
                                globals={'randint': random.randint,
                                         'hashcode': spf.hashcode,
                                         'json_encode': json.dumps})

URLS = (
    '/', 'Index',
    '/chunked', 'Chunked',
    '/chunked_sample_multipart', 'ChunkedSampleMultipart',
    '/chunked_sample_single', 'ChunkedSampleSingle',
    '/demo', 'Demo',
    '/demo/(.*)', 'Demo',
    '/index', 'Index',
    '/index_ajax', 'IndexAjax',
    '/missing', 'Missing',
    '/other', 'Other',
    '/other/(.*)', 'Other',
    '/spec', 'Spec',
    '/truncated', 'Truncated',
)


class Servlet(object):
    """Basic servlet class, containing common functions."""

    # pylint: disable=no-self-use
    def _set_chunked_headers(self):
        """Sets headers necessary for chunked transfer.

        Note: The web.py server always sets "Transfer-Encoding: chunked"
        and uses chunked transfer automatically, so manually setting
        headers is not necessary.  With other servers, this may not be true."""
        pass

    # pylint: disable=no-self-use
    def _set_json_headers(self):
        """Sets headers necessary for returning JSON content."""
        web.header('Content-Type', 'application/javascript')

    # pylint: disable=no-self-use
    def _set_spf_multipart_headers(self):
        """Sets headers necessary for returning multipart SPF responses."""
        web.header(spf.HeaderOut.RESPONSE_TYPE, spf.ResponseType.MULTIPART)

    # pylint: disable=no-self-use
    def is_spf_request(self):
        """Gets whether the current request is for SPF."""
        params = {spf.UrlIdentifier.PARAM: None}
        req = web.input(**params)  # pylint: disable=star-args
        return bool(req[spf.UrlIdentifier.PARAM])

    # pylint: disable=no-self-use
    def get_referer(self):
        """Gets the referer, preferring the custom SPF version."""
        referer = web.ctx.env.get(spf.HeaderIn.REFERER.cgi_env_var())
        if not referer:
            referer = web.ctx.env.get('HTTP_REFERER')
        return referer

    # pylint: disable=no-self-use
    def encode_json(self, response):
        """Encodes an object in JSON format."""
        if web.config.debug:
            return json.dumps(response, sort_keys=True, indent=4)
        else:
            return json.dumps(response, separators=(',', ':'))

    # pylint: disable=no-self-use
    def create_spf_response(self, content, fragments=None):
        """Creates an SPF response object for template.

        See http://youtube.github.io/spfjs/documentation/responses/ for an
        overview of responses, how they are processed, and formatting.

        Args:
            content: The content template instanace to render.
            fragments: Optional map of HTML Element IDs to template attributes
                to include instead of returning the entire content template.

        Returns:
            The SPF response object.
        """
        response = {}
        head = str(getattr(content, 'stylesheet', ''))
        if head:
            response[spf.ResponseKey.HEAD] = head
        foot = str(getattr(content, 'javascript', ''))
        if foot:
            response[spf.ResponseKey.FOOT] = foot
        title = str(getattr(content, 'title', ''))
        if title:
            response[spf.ResponseKey.TITLE] = title
        name = str(getattr(content, 'name', ''))
        if name:
            response[spf.ResponseKey.NAME] = name
        attr = json.loads(str(getattr(content, 'attributes', '{}')))
        if attr:
            response[spf.ResponseKey.ATTR] = attr
        if fragments:
            body = response[spf.ResponseKey.BODY] = {}
            for frag_id in fragments:
                body[frag_id] = getattr(content, fragments[frag_id])
        else:
            content_str = str(content)
            if content_str:
                response[spf.ResponseKey.BODY] = {'content': content_str}
        return response

    def render_spf(self, content, fragments=None):
        """Returns a rendered SPF response.

        Args:
            content: The content template instanace to render.
            fragments: Optional map of HTML Element IDs to template attributes
                to include instead of returning the entire content template.

        Returns:
            The rendered SPF response.
        """
        self._set_json_headers()
        resp = self.create_spf_response(content, fragments=fragments)
        return self.encode_json(resp)

    def chunked_render_spf(self, content, fragments=None, truncate=False):
        """Returns a 2-part multipart SPF response across multiple chunks.

        This demonstrates support for chunked responses but this simplistic
        usage obviously isn't particularly effective, as all content is ready
        to be sent back.  In real implementations, the first chunk should be
        sent before expensive backend work such as database queries or RPCs.

        Args:
            content: The content template instanace to render.
            fragments: Optional map of HTML Element IDs to template attributes
                to include instead of returning the entire content template.
            truncate: Whether to end the response early to simulate
                chunking/multipart serving errors.

        Yields:
            The partial SPF response(s).
        """
        self._set_chunked_headers()
        self._set_json_headers()
        self._set_spf_multipart_headers()
        # Get the complete response.
        resp = self.create_spf_response(content, fragments=fragments)
        # Extract out the first response part to send first.
        early = {}
        if spf.ResponseKey.HEAD in resp:
            early[spf.ResponseKey.HEAD] = resp.pop(spf.ResponseKey.HEAD)
        if spf.ResponseKey.TITLE in resp:
            early[spf.ResponseKey.TITLE] = resp.pop(spf.ResponseKey.TITLE)
        if spf.ResponseKey.NAME in resp:
            # Don't pop the name so that it is present in both parts.
            early[spf.ResponseKey.NAME] = resp[spf.ResponseKey.NAME]
        # Begin the multipart response.
        yield spf.MultipartToken.BEGIN
        # Send part 1.
        yield self.encode_json(early)
        yield spf.MultipartToken.DELIMITER
        # Simulate real work being done.
        time.sleep(0.25)
        if not truncate:
            # Send part 2.
            yield self.encode_json(resp)
            yield spf.MultipartToken.END

    def render_html(self, content):
        """Returns a rendered HTML response.

        Args:
            content: The content template instanace to render.

        Returns:
            The rendered HTML response.
        """
        return TEMPLATES.base(content)

    def chunked_render_html(self, content):
        """Returns a rendered HTML response for chunking.

        (Does not currently split the reponse but could be used to do so.)

        Args:
            content: The content template instanace to render.

        Yields:
            The rendered HTML response.
        """
        self._set_chunked_headers()
        yield TEMPLATES.base(content)

    def render(self, content):
        """Returns a rendered HTML or SPF response as needed.

        Args:
            content: The content template instanace to render.

        Returns:
            The rendered HTML or SPF response.
        """
        if self.is_spf_request():
            return self.render_spf(content)
        else:
            return self.render_html(content)

    def chunked_render(self, content, truncate=False):
        """Returns a rendered HTML or SPF response for chunking as needed.

        Args:
            content: The content template instanace to render.
            truncate: Whether to end the response early to simulate
                chunking/multipart serving errors.

        Yields:
            The rendered HTML or SPF response.
        """
        if self.is_spf_request():
            for chunk in self.chunked_render_spf(content, truncate=truncate):
                yield chunk
        else:
            for chunk in self.chunked_render_html(content):
                yield chunk

    def redirect(self, url):
        """Redirects to a given URL."""
        if self.is_spf_request():
            response = {spf.ResponseKey.REDIRECT: url}
            return self.encode_json(response)
        else:
            raise web.seeother(url)


# pylint: disable=too-few-public-methods
class Index(Servlet):
    """Handles requests to / and /index."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        content = TEMPLATES.index()
        return self.render(content)


class IndexAjax(Servlet):
    """Handles requests to /index_ajax."""

    # pylint: disable=invalid-name,missing-docstring
    def POST(self):
        content = TEMPLATES.index_ajax()
        # Only support an SPF response
        fragments = {'home_ajax_out': 'home_ajax_out'}
        return self.render_spf(content, fragments=fragments)


class Spec(Servlet):
    """Handles requests to /spec."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        content = TEMPLATES.spec()
        return self.render(content)


class Demo(Servlet):
    """Handles requests to /demo and /demo/*."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self, page_num=0):
        content = TEMPLATES.demo(page_num)
        # yield instead of return to support chunked responses
        for chunk in self.chunked_render(content):
            yield chunk


class Other(Servlet):
    """Handles requests to /other and /other/*."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self, arg=None):
        if arg is not None:
            return self.redirect('/other')
        referer = self.get_referer()
        content = TEMPLATES.other(referer)
        return self.render(content)


class Missing(Servlet):
    """Handles requests to /missing."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        web.ctx.status = '404 Not Found'
        return self.render(TEMPLATES.missing())


class Truncated(Servlet):
    """Handles requests to /truncated."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        content = TEMPLATES.truncated()
        # yield instead of return to support chunked responses
        for chunk in self.chunked_render(content, truncate=True):
            yield chunk


class Chunked(Servlet):
    """Handles requests to /chunked."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        return self.render(TEMPLATES.chunked())


class _ChunkedSample(Servlet):
    """Common base class for permutations of sample chunked responses."""

    def __init__(self):
        self.num_chunks = 1
        self.delay_time = 1
        self.no_final_delimiter = False
        self.no_multipart_header = False
        self.add_parse_error = False

    def _handle_input(self):
        """Handles request parameters for sample chunked responses."""
        req = web.input(chunks=1, delay='', no_final_delimiter='',
                        no_multipart_header='', add_parse_error='')
        try:
            self.num_chunks = int(req.chunks)
        except ValueError:
            self.num_chunks = 1
        try:
            self.delay_time = float(req.delay)
        except ValueError:
            self.delay_time = 1
        self.no_final_delimiter = bool(req.no_final_delimiter)
        self.no_multipart_header = bool(req.no_multipart_header)
        self.add_parse_error = bool(req.add_parse_error)
        return req

    # pylint: disable=no-self-use
    def _iter_chunks(self, string, number):
        """Generator to iterate over a string in a given number of chunks.

        Args:
            string: A string.
            number: The number of chunks to iterate.

        Yields:
            The equally-sized chunks of the string.
        """
        length = int(math.ceil(len(string) / float(number)))
        for idx in range(0, len(string), length):
            yield string[idx:idx+length]


class ChunkedSampleMultipart(_ChunkedSample):
    """Handles requests to /chunked_sample_multipart."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        self._handle_input()
        # Set headers.
        self._set_chunked_headers()
        self._set_json_headers()
        if not self.no_multipart_header:
            self._set_spf_multipart_headers()
        # Create a sample 3 part response.
        alpha = range(ord('a'), ord('z') + 1)
        group_1 = dict((chr(l), l) for l in alpha
                       if l < ord('i'))
        group_2 = dict((chr(l), l) for l in alpha
                       if l >= ord('i') and l < ord('q'))
        group_3 = dict((chr(l), l) for l in alpha
                       if l >= ord('q'))
        # Begin the multipart response.
        res = spf.MultipartToken.BEGIN
        # Add the parts.
        for group in [group_1, group_2, group_3]:
            if self.add_parse_error and group == group_2:
                res += '__parse_error__'
            res += self.encode_json(group) + spf.MultipartToken.DELIMITER
        # End the multipart response.
        res += 'null'  # Avoid trailing commas in JSON arrays.
        if self.no_final_delimiter:
            res += ']'  # Send a bad end token if requested for testing.
        else:
            res += spf.MultipartToken.END
        # Send across multiple chunks.
        for chunk in self._iter_chunks(res, self.num_chunks):
            time.sleep(self.delay_time)
            yield chunk


class ChunkedSampleSingle(_ChunkedSample):
    """Handles requests to /chunked_sample_single."""

    # pylint: disable=invalid-name,missing-docstring
    def GET(self):
        self._handle_input()
        # Set headers.
        self._set_chunked_headers()
        self._set_json_headers()
        # Create a sample 1 part response.
        alpha = range(ord('a'), ord('z') + 1)
        group = dict((chr(l), l) for l in alpha)
        res = self.encode_json(group)
        if self.add_parse_error:
            res += '__parse_error__'
        # Send across multiple chunks.
        for chunk in self._iter_chunks(res, self.num_chunks):
            time.sleep(self.delay_time)
            yield chunk


def main():
    """Run the application."""
    app = web.application(URLS, globals())
    app.run()


if __name__ == '__main__':
    main()
