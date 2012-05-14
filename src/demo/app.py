# Copyright 2012 Google Inc. All Rights Reserved.

"""Simple demo app for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'



import json
import os
import random
import web



# Set up the basic app config.
templates = web.template.render('templates/', globals={'random': random})
urls = (
  '/', 'index',
  '/index_ajax', 'index_ajax',
  '/spec', 'spec',
  '/page', 'page',
  '/page/(.*)', 'page',
)
app = web.application(urls, globals())


class servlet(object):
  def render_spf(self, content, sections=None):
    for var in ('title', 'javascript', 'stylesheet'):
      if not hasattr(content, var):
        setattr(content, var, '')
    response = {}
    css = str(content.stylesheet)
    if css:
      response['css'] = css
    js = str(content.javascript)
    if js:
      response['js'] = js
    title = str(content.title)
    if title:
      response['title'] = title
    if sections:
      response['html'] = {}
      for sect in sections:
        response['html'][sect] = getattr(content, sect)
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
    return self.render_spf(content, sections=['home_ajax_out'])


class spec(servlet):
  def GET(self):
    content = templates.spec()
    return self.render(content)


class page(servlet):
  def GET(self, page_num=0):
    content = templates.page(page_num)
    return self.render(content)


if __name__ == '__main__':
  app.run()
