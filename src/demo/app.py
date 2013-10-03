"""Simple demo app for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'


import json
import math
import os
import random
import time

import web


def Hashcode(s):
  """A string hash function for compatibility with spf.string.hashCode.

  This function is similar to java.lang.String.hashCode().
  The hash code for a string is computed as
  s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
  where s[i] is the ith character of the string and n is the length of
  the string. We mod the result to make it between 0 (inclusive) and 2^32
  (exclusive).

  Args:
    s: A string.

  Returns:
    Integer hash value for the string, between 0 (inclusive) and 2^32
    (exclusive).  The empty string returns 0.
  """
  result = 0
  max_value = 2**32
  for char in s:
    result = (31 * result) + ord(char)
    result %= max_value
  return result


# Set up the basic app config.
templates = web.template.render('templates/',
                                globals={'randint': random.randint,
                                         'hashcode': Hashcode})

urls = (
    '/', 'Index',
    '/index_ajax', 'IndexAjax',
    '/spec', 'Spec',
    '/page', 'Page',
    '/page/(.*)', 'Page',
    '/missing', 'Missing',
    '/other', 'Other',
    '/other/(.*)', 'Other',
    '/chunked', 'Chunked',
    '/chunked_sample_multipart', 'ChunkedSampleMultipart',
    '/chunked_sample_single', 'ChunkedSampleSingle',
)
app = web.application(urls, globals())


class Servlet(object):
  """Basic demo servlet class, containing common functions."""

  def _SetChunkedHeaders(self):
    # The web.py demo server always sets "Transfer-Encoding: chunked"
    # and uses chunked transfer automatically, so manually setting
    # headers is not necessary.
    pass

  def _SetJSONHeaders(self):
    web.header('Content-Type', 'application/javascript')

  def _SetSPFMultipartHeaders(self):
    web.header('X-SPF-Response-Type', 'multipart')

  def IsSPFRequest(self):
    """Gets whether the current request is for SPF."""
    req = web.input(spf=None)
    has_spf_header = bool(web.ctx.env.get('HTTP_X_SPF_REQUEST'))
    has_spf_param = bool(req.spf)
    return has_spf_header or has_spf_param

  def GetReferer(self):
    """Gets the referer, preferring the custom SPF version."""
    referer = web.ctx.env.get('HTTP_X_SPF_REFERER')
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

    The object has the basic following format:
    - css: HTML string containing <link> and <style> tags of CSS to install.
    - html: Map of Element IDs to HTML strings containing content with which
         to update the Elements.
    - attr: Map of Element IDs to maps of attibute names to attribute values
         to set on the Elements.
    - js: HTML string containing <script> tags of JS to execute.
    - title: String of the new Document title.
    - timing: Map of timing attributes to timestamp numbers.
    - redirect: String of a URL to request instead.

    Args:
      content: The content template instanace to render.
      fragments: Optional map of HTML Element IDs to template attributes
        to include instead of returning the entire content template.

    Returns:
      The SPF response object.
    """
    response = {}
    css = str(getattr(content, 'stylesheet', ''))
    if css:
      response['css'] = css
    js = str(getattr(content, 'javascript', ''))
    if js:
      response['js'] = js
    title = str(getattr(content, 'title', ''))
    if title:
      response['title'] = title
    attr = json.loads(str(getattr(content, 'attributes', '{}')))
    if attr:
      response['attr'] = attr
    if fragments:
      response['html'] = {}
      for frag_id in fragments:
        response['html'][frag_id] = getattr(content, fragments[frag_id])
    else:
      content_str = str(content)
      if content_str:
        response['html'] = {'content': content_str}
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

  def ChunkedRenderSPF(self, content, fragments=None):
    """Returns a 2-part multipart SPF response across multiple chunks.

    This demonstrates support for chunked responses but this simplistic usage
    obviously isn't particularly effective, as all content is ready to be sent
    back.  In real implementations, the first chunk should be sent before
    expensive backend work such as database queries or RPCs.

    Args:
      content: The content template instanace to render.
      fragments: Optional map of HTML Element IDs to template attributes
        to include instead of returning the entire content template.

    Yields:
      The partial SPF response(s).
    """
    self._SetChunkedHeaders()
    self._SetJSONHeaders()
    self._SetSPFMultipartHeaders()
    # For clarity, use variables for the structure of a multipart response.
    multipart_begin = '[\r\n'
    multipart_delim = ',\r\n'
    multipart_end = ']\r\n'
    resp = self.CreateSPFResponse(content, fragments=fragments)
    first_chunk = {}
    if 'css' in resp:
      first_chunk['css'] = resp.pop('css')
    if 'title' in resp:
      first_chunk['title'] = resp.pop('title')
    # Begin the multipart response.
    yield multipart_begin
    # Send part 1.
    yield self.EncodeJSON(first_chunk)
    yield multipart_delim
    # Simulate real work being done.
    time.sleep(0.25)
    # Send part 2.
    yield self.EncodeJSON(resp)
    yield multipart_end

  def RenderHtml(self, content):
    """Returns a rendered HTML response.

    Args:
      content: The content template instanace to render.

    Returns:
      The rendered HTML response.
    """
    req = web.input(dev=None)
    is_debug = web.config.debug
    is_dev = web.config.debug and bool(req.dev)
    return templates.base(content, is_debug, is_dev)

  def ChunkedRenderHTML(self, content):
    """Returns a rendered HTML response for chunking.

    (Does not currently split the reponse but could be used to do so.)

    Args:
      content: The content template instanace to render.

    Yields:
      The rendered HTML response.
    """
    self._SetChunkedHeaders()
    req = web.input(dev=None)
    is_debug = web.config.debug
    is_dev = web.config.debug and bool(req.dev)
    yield templates.base(content, is_debug, is_dev)

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

  def ChunkedRender(self, content):
    """Returns a rendered HTML or SPF response for chunking as needed.

    Args:
      content: The content template instanace to render.

    Yields:
      The rendered HTML or SPF response.
    """
    if self.IsSPFRequest():
      for chunk in self.ChunkedRenderSPF(content):
        yield chunk
    else:
      for chunk in self.ChunkedRenderHTML(content):
        yield chunk

  def Redirect(self, url):
    """Redirects to a given URL."""
    if self.IsSPFRequest():
      response = {'redirect': url}
      return self.EncodeJSON(response)
    else:
      raise web.seeother(url)


class Index(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.index()
    return self.Render(content)


class IndexAjax(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.index_ajax()
    # Only support an SPF response
    fragments = {'home_ajax_out': 'home_ajax_out'}
    return self.RenderSPF(content, fragments=fragments)


class Spec(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    content = templates.spec()
    return self.Render(content)


class Page(Servlet):
  def GET(self, page_num=0):  # pylint: disable=invalid-name,missing-docstring
    content = templates.page(page_num)
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


class Chunked(Servlet):
  def GET(self):  # pylint: disable=invalid-name,missing-docstring
    return self.Render(templates.chunked())


class _ChunkedSample(Servlet):
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
    # For clarity, use variables for the structure of a multipart response.
    multipart_begin = '[\r\n'
    multipart_delim = ',\r\n'
    multipart_end = ']\r\n'
    alpha = range(ord('a'), ord('z') + 1)
    group_1 = dict((chr(l), l) for l in alpha if l < ord('i'))
    group_2 = dict((chr(l), l) for l in alpha if l >= ord('i') and l < ord('q'))
    group_3 = dict((chr(l), l) for l in alpha if l >= ord('q'))
    # Begin the multipart response.
    res = multipart_begin
    # Add the parts.
    for group in [group_1, group_2, group_3]:
      if self.add_parse_error and group == group_2:
        res += '__parse_error__'
      res += self.EncodeJSON(group) + multipart_delim
    # End the multipart response.
    res += 'null'  # Avoid trailing commas in JSON arrays.
    if self.no_final_delimiter:
      res += ']'
    else:
      res += multipart_end
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
