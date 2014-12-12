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
      title = title_regex.match(html).captures[0]
      head_regex = /<!-- begin spf head -->(.*)<!-- end spf head -->/m
      head = head_regex.match(html).captures[0]
      foot_regex = /<!-- begin spf foot -->(.*)<!-- end spf foot -->/m
      foot = foot_regex.match(html).captures[0]
      main_regex = /<main[^>]*>(.*)<\/main>/m
      main = main_regex.match(html).captures[0]
      body_class_regex = /<body class="([^"]*)">/
      body_class = body_class_regex.match(html).captures[0]

      response = {
        'title' => title,
        'head' => head,
        'body' => {'main' => main},
        'attr' => {'body' => {'class' => body_class}},
        'foot' => foot,
      }
      @output = response.to_json
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
