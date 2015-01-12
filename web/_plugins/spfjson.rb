# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Jekyll plugin to generate a SPF JSON version of each page.
#
# Author:: nicksay@google.com (Alex Nicksay)


require 'json'


module Jekyll


  class SpfJsonPage < Page

    def initialize(site, base, original)
      @site = site
      @base = base
      # Get the @dir value from the original page, not the dir() output.
      @dir = original.instance_variable_get(:@dir)
      @name = original.name

      process(@name)

      @content = original.content
      @data = original.data
    end

    def render(layouts, site_payload)
      super
      html = @output

      title_regex = /<title>(.*)<\/title>/m
      head_regex = /<!-- begin spf head -->(.*)<!-- end spf head -->/m
      body_regex = /<!-- begin spf body: (\w+) -->(.*)<!-- end spf body: \1 -->/m
      foot_regex = /<!-- begin spf foot -->(.*)<!-- end spf foot -->/m
      attr_body_class_regex = /<body[^>]* class="([^"]*)"/

      title = html.match(title_regex)[1]
      head = html.match(head_regex)[1]
      body = {}
      html.scan(body_regex).each do |group|
        body[group[0]] = group[1]
      end
      foot = html.match(foot_regex)[1]
      attr_body_class = html.match(attr_body_class_regex)[1]
      attrs = {
        'body' => {'class' => attr_body_class}
      }

      response = {
        'title' => title,
        'head' => head,
        'body' => body,
        'attr' => attrs,
        'foot' => foot,
      }
      # Use JSON.pretty_generate instead of response.to_json or JSON.generate
      # to reduce diff sizes during updates, since the files are checked in.
      @output = JSON.pretty_generate(response)
    end

    # Output a .json file.
    def output_ext
      '.spf.json'
    end

    # Masquerade as an .html file.
    def html?
      true
    end

    # Output index.spf.json files, not index.html files.
    def destination(dest)
      path = site.in_dest_dir(dest, URL.unescape_path(url))
      path = File.join(path, 'index.spf.json') if url =~ /\/$/
      path
    end

  end


  class SpfJsonPageGenerator < Generator

    safe true
    priority :low

    def generate(site)
      pages = []
      site.pages.each do |page|
        pages << SpfJsonPage.new(site, site.source, page)
      end
      site.pages.concat(pages)
    end

  end


end
