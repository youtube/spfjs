# Copyright 2015 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Jekyll plugin to convert Markdown ".md" links into Jekyll "pretty" permalinks.
#
# Author:: nicksay@google.com (Alex Nicksay)


module Jekyll

  module Converters

    class Markdown < Converter

      @@md_link_pattern = /(:\s+|\()([.\w\/]+)\.md($|#|\))/

      def process_and_convert(content)
        processed_content = content.gsub(@@md_link_pattern) do
          m = Regexp.last_match
          link = "#{m[2]}/"
          if link.start_with?('./')
            link = link.sub('./', '../')
          elsif link.start_with?('../')
            link = "../#{link}"
          end

          "#{m[1]}#{link}#{m[3]}"
        end
        setup
        @parser.convert(processed_content)
      end

      alias_method :_convert, :convert
      alias_method :convert, :process_and_convert

    end

  end

end
