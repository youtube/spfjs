# Copyright 2012 Google Inc. All Rights Reserved.

"""Simple demo app for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'



import json
import os
import web



# Set up the basic app config.
templates = web.template.render('templates/')
urls = (
  '/', 'index',
  '/spec', 'spec',
  '/page', 'page',
  '/page/(.*)', 'page',
)
app = web.application(urls, globals())


class servlet(object):
  def render(self, content):
    for var in ('title', 'javascript', 'stylesheet'):
      if not hasattr(content, var):
        setattr(content, var, '')
    req = web.input(spf=None)
    if req.spf:
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
      content = str(content)
      if content:
        response['html'] = {'content': content}
      web.header('Content-type', 'application/json')
      if web.config.debug:
        return json.dumps(response, sort_keys=True, indent=4)
      else:
        return json.dumps(response, separators=(',', ':'))
    else:
      return templates.base(content)


class index(servlet):
  def GET(self):
    content = templates.index()
    return self.render(content)


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
