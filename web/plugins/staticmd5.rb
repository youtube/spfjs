# Copyright 2015 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Jekyll plugin to generate a MD5 hashcode for every static file.
#
# Author:: nicksay@google.com (Alex Nicksay)


require 'digest'


module Jekyll

  class StaticFile

    def md5
      Digest::MD5.file(path).hexdigest
    end

    def to_liquid
      {
        "path"          => File.join("", relative_path),
        "modified_time" => mtime.to_s,
        "extname"       => File.extname(relative_path),
        "md5"           => md5
      }
    end

  end


  class StaticMD5Generator < Generator

    safe true
    priority :low

    def generate(site)
      static_files_index = {}
      site.static_files.each do |static_file|
        path = File.join("", static_file.relative_path)
        static_files_index[path] = static_file
      end
      site.data['static_files_index'] = static_files_index
    end

  end


  module StaticMD5Filter

    def md5_cgi_url(input)
      static_file = @context.registers[:site].data['static_files_index'][input]
      "#{input}?md5=#{static_file.md5}"
    end

  end


end


Liquid::Template.register_filter(Jekyll::StaticMD5Filter)
