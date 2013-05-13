"""Simple demo app for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'


import json
import os
import sys
import random

import web


# A string hash function for compatibility with spf.string.hashCode.
def hashcode(s):
  result = 0
  max_value = 2**32
  for char in s:
    result = (31 * result) + ord(char)
    result %= max_value
  return result


# Set up the basic app config.
templates = web.template.render('templates/',
                                globals={'randint': random.randint,
                                         'hashcode': hashcode,
                                         'debug': web.config.debug})
urls = (
  '/', 'index',
  '/index_ajax', 'index_ajax',
  '/spec', 'spec',
  '/page', 'page',
  '/page/(.*)', 'page',
  '/missing', 'missing',
  '/other', 'other',
  '/other/(.*)', 'other',
)
app = web.application(urls, globals())


class servlet(object):
  def render_spf(self, content, fragments=None):
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
    web.header('Content-Type', 'application/json')
    web.header('Cache-Control', 'no-cache')
    web.header('Pragma', 'no-cache') # IE
    if web.config.debug:
      return json.dumps(response, sort_keys=True, indent=4)
    else:
      return json.dumps(response, separators=(',', ':'))

  def render_html(self, content):
    return templates.base(content)

  def render(self, content):
    req = web.input(spf=None)
    if req.spf:
      return self.render_spf(content)
    else:
      return self.render_html(content)


class index(servlet):
  def GET(self):
    content = templates.index()
    return self.render(content)


class index_ajax(servlet):
  def GET(self):
    content = templates.index_ajax()
    # Only support an SPF response
    fragments = {'home_ajax_out': 'home_ajax_out'}
    return self.render_spf(content, fragments=fragments)


class spec(servlet):
  def GET(self):
    content = templates.spec()
    return self.render(content)


class page(servlet):
  def GET(self, page_num=0):
    content = templates.page(page_num)
    return self.render(content)


class other(servlet):
  def GET(self, arg=None):
    if arg is not None:
      req = web.input(spf=None)
      if req.spf:
        raise web.seeother('/other?spf=1')
      else:
        raise web.seeother('/other')
    referer = web.ctx.env.get('HTTP_REFERER')
    content = templates.other(referer)
    return self.render(content)


class missing(servlet):
  def GET(self):
    web.ctx.status = '404 Not Found'
    return self.render(templates.missing())


if __name__ == '__main__':
  app.run()
