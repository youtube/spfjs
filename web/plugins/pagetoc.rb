# Copyright 2015 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Jekyll plugin to build a page table of contents using Redcarpet's TOC data.
#
# Author:: nicksay@google.com (Alex Nicksay)


require 'redcarpet'


module Jekyll


  class Page

    def render_and_generate_toc(payload, layouts)
      # Generate the page TOC.
      if @content
        toc_renderer = Redcarpet::Render::HTML_TOC.new
        toc = Redcarpet::Markdown.new(toc_renderer, {}).render(@content)
        # Work around a Redcarpet bug
        toc = toc.gsub('&lt;em&gt;', '<em>')
        toc = toc.gsub('&lt;/em&gt;', '</em>')
        @data['toc'] = toc
      end
      # Then call the default render method.
      _render(payload, layouts)
    end

    alias_method :_render, :render
    alias_method :render, :render_and_generate_toc

  end


end
