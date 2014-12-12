# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

"""Simple demo server app for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'


import json
import math
import os
import random
import time

import spf
import web


# Set up the basic app config.
templates = web.template.render('templates/',
                                globals={'randint': random.randint,
                                         'hashcode': spf.hashcode,
                                         'json_encode': json.dumps})

urls = (
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
app = web.application(urls, globals())


class Servlet(object):
  """Basic servlet class, containing common functions."""

  def _SetChunkedHeaders(self):
    # The web.py server always sets "Transfer-Encoding: chunked"
    # and uses chunked transfer automatically, so manually setting
    # headers is not necessary.
    pass

  def _SetJSONHeaders(self):
    web.header('Content-Type', 'application/javascript')

  def _SetSPFMultipartHeaders(self):
    web.header(spf.HeaderOut.RESPONSE_TYPE, spf.ResponseType.MULTIPART)

  def IsSPFRequest(self):
    """Gets whether the current request is for SPF."""
    req = web.input(**{spf.UrlIdentifier.KEY: None})
    return bool(req[spf.UrlIdentifier.KEY])

  def GetReferer(self):
    """Gets the referer, preferring the custom SPF version."""
    referer = web.ctx.env.get(spf.HeaderIn.REFERER.cgi_env_var())
    if not referer:
      referer = web.ctx.env.get('HTTP_REFERER')
    return referer

  def EncodeJSON(self, response):
    """Encodes an object in JSON format."""
    if web.config.debug:
      return json.dumps(response, sort_keys=True, indent=4)
    else:
      return json.dumps(response, separators=(',', ':'))

  def CreateSPFResponse(self, content, fragments=None):
    """Creates an SPF response object for template.

    See http://youtube.github.io/spfjs/documentation/responses/ for an overview
    of respones, how they are processed, and formatting.

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

  def RenderSPF(self, content, fragments=None):
    """Returns a rendered SPF response.

    Args:
      content: The content template instanace to render.
      fragments: Optional map of HTML Element IDs to template attributes
        to include instead of returning the entire content template.

    Returns:
      The rendered SPF response.
    """
    self._SetJSONHeaders()
    resp = self.CreateSPFResponse(content, fragments=fragments)
    return self.EncodeJSON(resp)

  def ChunkedRenderSPF(self, content, fragments=None, truncate=False):
    """Returns a 2-part multipart SPF response across multiple chunks.

    This demonstrates support for chunked responses but this simplistic usage
    obviously isn't particularly effective, as all content is ready to be sent
    back.  In real implementations, the first chunk should be sent before
    expensive backend work such as database queries or RPCs.

    Args:
      content: The content template instanace to render.
      fragments: Optional map of HTML Element IDs to template attributes
        to include instead of returning the entire content template.
      truncate: Whether to end the response early to simulate chunking/multipart
        serving errors.

    Yields:
      The partial SPF response(s).
    """
    self._SetChunkedHeaders()
    self._SetJSONHeaders()
    self._SetSPFMultipartHeaders()
    resp = self.CreateSPFResponse(content, fragments=fragments)
    first_chunk = {}
    if spf.ResponseKey.HEAD in resp:
      first_chunk[spf.ResponseKey.HEAD] = resp.pop(spf.ResponseKey.HEAD)
    if spf.ResponseKey.TITLE in resp:
      first_chunk[spf.ResponseKey.TITLE] = resp.pop(spf.ResponseKey.TITLE)
    # Begin the multipart response.
    yield spf.MultipartToken.BEGIN
    # Send part 1.
    yield self.EncodeJSON(first_chunk)
    yield spf.MultipartToken.DELIMITER
    # Simulate real work being done.
    time.sleep(0.25)
    if not truncate:
      # Send part 2.
      yield self.EncodeJSON(resp)
      yield spf.MultipartToken.END

  def RenderHtml(self, content):
    """Returns a rendered HTML response.

    Args:
      content: The content template instanace to render.

    Returns:
      The rendered HTML response.
    """
    return templates.base(content)

  def ChunkedRenderHTML(self, content):
    """Returns a rendered HTML response for chunking.

    (Does not currently split the reponse but could be used to do so.)

    Args:
      content: The content template instanace to render.

    Yields:
      The rendered HTML response.
    """
    self._SetChunkedHeaders()
    yield templates.base(content)

  def Render(self, content):
    """Returns a rendered HTML or SPF response as needed.

    Args:
      content: The content template instanace to render.

    Returns:
      The rendered HTML or SPF response.
    """
    if self.IsSPFRequest():
      return self.RenderSPF(content)
    else:
      return self.RenderHtml(content)

  def ChunkedRender(self, content, truncate=False):
    """Returns a rendered HTML or SPF response for chunking as needed.

    Args:
      content: The content template instanace to render.
      truncate: Whether to end the response early to simulate chunking/multipart
        serving errors.

    Yields:
      The rendered HTML or SPF response.
    """
    if self.IsSPFRequest():
      for chunk in self.ChunkedRenderSPF(content, truncate=truncate):
        yield chunk
    else:
      for chunk in self.ChunkedRenderHTML(content):
        yield chunk

  def Redirect(self, url):
    """Redirects to a given URL."""
    if self.IsSPFRequest():
      response = {spf.ResponseKey.REDIRECT: url}
      return self.EncodeJSON(response)
    else:
      raise web.seeother(url)


class Index(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.index()
    return self.Render(content)


class IndexAjax(Servlet):
  def POST(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.index_ajax()
    # Only support an SPF response
    fragments = {'home_ajax_out': 'home_ajax_out'}
    return self.RenderSPF(content, fragments=fragments)


class Spec(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.spec()
    return self.Render(content)


class Demo(Servlet):
  def GET(self, page_num=0):  # pylint: disable=invalid-name,missing-docstring
    content = templates.demo(page_num)
    # yield instead of return to support chunked responses
    for chunk in self.ChunkedRender(content):
      yield chunk


class Other(Servlet):
  def GET(self, arg=None):  # pylint: disable=invalid-name,missing-docstring
    if arg is not None:
      return self.Redirect('/other')
    referer = self.GetReferer()
    content = templates.other(referer)
    return self.Render(content)


class Missing(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    web.ctx.status = '404 Not Found'
    return self.Render(templates.missing())


class Truncated(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.truncated()
    # yield instead of return to support chunked responses
    for chunk in self.ChunkedRender(content, truncate=True):
      yield chunk


class Chunked(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    return self.Render(templates.chunked())


class _ChunkedSample(Servlet):
  """Common root servlet class for permutations for sample chunked responses."""

  def _HandleInput(self):
    """Handles request parameters for the sample chunked responses."""
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

  def _IterChunks(self, s, n):
    """Generator to iterate over a string in a given number of chunks.

    Args:
      s: A string.
      n: The number of chunks to iterate.

    Yields:
      The equally-sized chunks of the string.
    """
    l = int(math.ceil(len(s) / float(n)))
    for i in range(0, len(s), l):
      yield s[i:i+l]


class ChunkedSampleMultipart(_ChunkedSample):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    self._HandleInput()
    # Set headers.
    self._SetChunkedHeaders()
    self._SetJSONHeaders()
    if not self.no_multipart_header:
      self._SetSPFMultipartHeaders()
    # Create a sample 3 part response.
    alpha = range(ord('a'), ord('z') + 1)
    group_1 = dict((chr(l), l) for l in alpha if l < ord('i'))
    group_2 = dict((chr(l), l) for l in alpha if l >= ord('i') and l < ord('q'))
    group_3 = dict((chr(l), l) for l in alpha if l >= ord('q'))
    # Begin the multipart response.
    res = spf.MultipartToken.BEGIN
    # Add the parts.
    for group in [group_1, group_2, group_3]:
      if self.add_parse_error and group == group_2:
        res += '__parse_error__'
      res += self.EncodeJSON(group) + spf.MultipartToken.DELIMITER
    # End the multipart response.
    res += 'null'  # Avoid trailing commas in JSON arrays.
    if self.no_final_delimiter:
      res += ']'  # Send a bad end token if requested for testing.
    else:
      res += spf.MultipartToken.END
    # Send across multiple chunks.
    for chunk in self._IterChunks(res, self.num_chunks):
      time.sleep(self.delay_time)
      yield chunk


class ChunkedSampleSingle(_ChunkedSample):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    self._HandleInput()
    # Set headers.
    self._SetChunkedHeaders()
    self._SetJSONHeaders()
    # Create a sample 1 part response.
    alpha = range(ord('a'), ord('z') + 1)
    group = dict((chr(l), l) for l in alpha)
    res = self.EncodeJSON(group)
    if self.add_parse_error:
      res += '__parse_error__'
    # Send across multiple chunks.
    for chunk in self._IterChunks(res, self.num_chunks):
      time.sleep(self.delay_time)
      yield chunk


if __name__ == '__main__':
  app.run()
