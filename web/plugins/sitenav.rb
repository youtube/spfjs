# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Jekyll plugin to build a site navigation tree from directory layout.
#
# Author:: nicksay@google.com (Alex Nicksay)


module Jekyll


  class SiteNavIndexPage < Page

    def initialize(site, base, dir, item)
      @site = site
      @base = base
      @dir = dir
      @name = 'index.html'

      process(@name)

      @data = {}
      @data.default_proc = proc do |hash, key|
        site.frontmatter_defaults.find(File.join(dir, name), type, key)
      end
      if item.has_key?('title')
        @data['title'] = item['title']
      else
        @data['title'] = dir.split('/').last.capitalize
      end
      if item.has_key?('description')
        @data['description'] = item['description']
      end
      @data['index'] = true
    end

  end


  class SiteNavGenerator < Generator

    safe true
    priority :normal

    def link(siblings, parent, pages, sitenav_index, prefix, site)
      siblings.each_with_index do |item, index|
        url = [prefix, item['path']].join('/').gsub('//', '/')
        item['url'] = url
        # For directories, create empty index pages if needed.
        if url.end_with?('/') and not pages.has_key?(url)
          index_page = SiteNavIndexPage.new(site, site.source, url, item)
          site.pages << index_page
          pages[url] = index_page
          index_page.data['original_layout'] = index_page.data['layout']
        end
        # Link item -> page.
        item['page'] = pages[url]
        # Link url -> item.
        sitenav_index[url] = item
        # Link item -> parent, prev/next, children.
        item['parent'] = parent
        item['prev'] = siblings[index - 1] unless item == siblings.first
        item['next'] = siblings[index + 1] unless item == siblings.last
        if item.key?('children')
          link(item['children'], item, pages, sitenav_index, url, site)
          # Update prev/next to link into and out of children.
          item['children'].first['prev'] = item
          unless item['children'].last.key?('children')
            item['children'].last['next'] = item['next']
          end
          item['next'] = item['children'].first
        end
      end
    end

    def generate(site)
      pages = {}
      site.pages.each do |page|
        url = page.url.sub('index.html', '')
        pages[url] = page
        page.data['original_layout'] = page.data['layout']
      end
      sitenav_index = {}
      link(site.data['sitenav'], nil, pages, sitenav_index, '', site)
      site.data['sitenav_index'] = sitenav_index
    end

  end


end
