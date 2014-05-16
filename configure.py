#!/usr/bin/env python
#
# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

"""Script that generates the build.ninja file for SPF."""

__author__ = 'nicksay@google.com (Alex Nicksay)'

import distutils.version
import glob
import os
import subprocess
import sys


BUILD_FILENAME = 'build.ninja'
BUILD_DIR = 'build'


def check_requirements():
  # Closure Compiler v20131014 is the last release to support Java 6.
  required_java = distutils.version.LooseVersion('1.6')
  try:
    cmd = subprocess.Popen(['java', '-version'],
                           stderr=subprocess.STDOUT,
                           stdout=subprocess.PIPE)
  except OSError:
    print('ERROR: Unable to find java.')
    print('Please install java and try again.')
    sys.exit(1)
  out = cmd.stdout.readlines()
  if len(out) <= 0:
    print('ERROR: Unable to get java version.')
    print('Please ensure java is properly installed and try again.')
    sys.exit(1)
  version_string = out[0].split(' ')[-1].strip('\n"')
  installed_java = distutils.version.LooseVersion(version_string)
  if installed_java < required_java:
    print('ERROR: Installed java version "%s" is less than the required "%s".' %
          (installed_java, required_java))
    print('Please upgrade java and try again.')
    sys.exit(1)
  # Ensure required git submodules have been initialized.
  submodule_ninja_file = 'vendor/ninja/misc/ninja_syntax.py'
  submodule_webpy_file = 'vendor/webpy/web/webapi.py'
  if not (os.path.isfile(submodule_ninja_file) and
          os.path.isfile(submodule_webpy_file)):
    try:
      ret = subprocess.call(['git', 'submodule', 'update', '--init', '--force'])
    except OSError:
      print('ERROR: Unable to find git.')
      print('Please install git and try again.')
      sys.exit(1)
    if ret > 0:
      print('ERROR: Unable to update git submodules.')
      print('Please run "git submodule update --init --force" manually.')
      sys.exit(1)

def find_js_sources():
  sources = ['src/client/stub.js']
  for root, dirs, files in os.walk('src/client'):
    if root.endswith('testing'):
      continue
    for file in files:
      if file.endswith('.js'):
        if file.startswith('stub') or file.endswith('test.js'):
          continue
        sources.append(os.path.join(root, file))
  return sources


def find_js_tests():
  tests = []
  for root, dirs, files in os.walk('src/client'):
    for file in files:
      if file.endswith('test.js'):
        tests.append(os.path.join(root, file))
  return tests


def find_demo_sources():
  sources = []
  for root, dirs, files in os.walk('src/server/demo'):
    for file in files:
      if os.path.splitext(file)[1]:  # Only grab source files.
        sources.append(os.path.join(root, file))
  return sources


def create_ninja_file():
  # Do this during execution to allow checking for presence.
  sys.path.insert(0, 'vendor/ninja/misc')
  import ninja_syntax

  os.chdir(os.path.dirname(os.path.abspath(__file__)))
  buildfile = open(BUILD_FILENAME, 'w')
  return ninja_syntax.Writer(buildfile)


def write_header(ninja):
  ninja.comment('Copyright 2014 Google Inc. All rights reserved.')
  ninja.newline()
  ninja.comment('Use of this source code is governed by The MIT License.')
  ninja.comment('See the LICENSE file for details.')
  ninja.newline()
  ninja.comment('This generated file is used to build SPF.')
  ninja.comment('To update, run ' + os.path.basename(__file__) + '.')
  ninja.newline()


def write_variables(ninja):
  ninja.variable('builddir', BUILD_DIR)
  ninja.variable('jscompiler_jar', 'vendor/closure-compiler/compiler.jar')
  ninja.variable('license_js', 'src/license.js')
  ninja.variable('license', 'cat $license_js')
  ninja.variable('preamble', 'true')

  common_jsflags = [
      '--compilation_level ADVANCED_OPTIMIZATIONS',
      '--define "COMPILED=true"',
      '--define "SPF_COMPILED=true"',
      '--output_wrapper "(function(){%output%})();"',
      '--manage_closure_dependencies true',
      '--process_closure_primitives true',
  ]
  prod_jsflags = common_jsflags + [
      '--define "SPF_DEBUG=false"',
      '--summary_detail_level 3',
      '--warning_level VERBOSE',
  ]
  debug_jsflags = common_jsflags + [
      '--debug true',
      '--formatting PRETTY_PRINT',
  ]
  trace_jsflags = common_jsflags + [
      '--define "SPF_DEBUG=false"',
      '--define "SPF_TRACING=true"',
  ]
  dev_jsflags = [
      '--compilation_level WHITESPACE_ONLY',
      '--formatting PRETTY_PRINT',
      '--manage_closure_dependencies true',
  ]
  main_jsflags = [
      '--closure_entry_point spf.main',
  ]
  bootloader_jsflags = [
      '--closure_entry_point spf.bootloader',
  ]
  ninja.variable('prod_jsflags', ' '.join(prod_jsflags))
  ninja.variable('debug_jsflags', ' '.join(debug_jsflags))
  ninja.variable('trace_jsflags', ' '.join(trace_jsflags))
  ninja.variable('dev_jsflags', ' '.join(dev_jsflags))
  ninja.variable('main_jsflags', ' '.join(main_jsflags))
  ninja.variable('bootloader_jsflags', ' '.join(bootloader_jsflags))
  ninja.newline()


def write_rules(ninja):
  # Build JS files.
  ninja.rule('jscompiler',
             command='$license > $out '
                     '&& $preamble >> $out '
                     '&& java -jar $jscompiler_jar $flags $in >> $out '
                     '|| rm $out',
             description='jscompiler $out')
  # Build build file.
  ninja.rule('configure',
             command='python ./configure.py',
             generator=True)
  # Symlink.
  ninja.rule('symlink',
             command='ln -sf $prefix$in $out',
             description='symlink $prefix$in -> $out')
  # Download files.
  ninja.rule('download',
             command='curl -L $url -o $out',
             generator=True,
             description='download $url -> $out')
  # Unpack files.
  ninja.rule('unzip',
             command='unzip -u $flags $in $paths -d $dest',
             restat=True,
             description='unzip $in -> $dest')
  # Generate test manifest.
  ninja.rule('gen_test_manifest',
             command=('echo $in '
                      '| tr " " "\\n" '
                      '| sed "s,^,document.write(\'<script src=\\"$prefix,g" '
                      '| sed "s,$$,\\"></script>\');,g" '
                      '> $out'),
             description='generate $out')
  ninja.newline()


def write_targets(ninja):
  license_js = '$license_js'

  ninja.comment('Libraries.')
  # Closure Compiler is unpacked from a zip download.
  jscompiler_jar = '$jscompiler_jar' # Globally defined to allow use in rules.
  jscompiler_url = 'http://dl.google.com/closure-compiler/compiler-20131014.zip'
  jscompiler_zip = 'vendor/closure-compiler/compiler-20131014.zip'
  jscompiler_zip_dest = 'vendor/closure-compiler'
  jscompiler_zip_outs = [
      'vendor/closure-compiler/COPYING',
      'vendor/closure-compiler/README',
      jscompiler_jar,
  ]
  ninja.build(jscompiler_zip, 'download',
              variables=[('url', jscompiler_url)])
  ninja.build(jscompiler_zip_outs, 'unzip', jscompiler_zip,
              variables=[('dest', jscompiler_zip_dest)])

  # Jasmine is unpacked from a zip download.
  jasmine_url = 'https://github.com/pivotal/jasmine/raw/master/dist/jasmine-standalone-1.3.1.zip'
  jasmine_zip = 'vendor/jasmine/jasmine-standalone-1.3.1.zip'
  jasmine_zip_dest = 'vendor/jasmine'
  jasmine_zip_outs = [
      'vendor/jasmine/MIT.LICENSE',
      'vendor/jasmine/jasmine.css',
      'vendor/jasmine/jasmine.js',
      'vendor/jasmine/jasmine-html.js',
  ]
  ninja.build(jasmine_zip, 'download',
              variables=[('url', jasmine_url)])
  ninja.build(jasmine_zip_outs, 'unzip', jasmine_zip,
              variables=[('flags', '-j'),
                         ('paths', '"lib/*"'),
                         ('dest', jasmine_zip_dest)])

  wtf_shim = 'vendor/tracing-framework/shims/wtf-trace-closure.js'
  js_srcs = find_js_sources() + [wtf_shim]

  ninja.comment('Main.')
  ninja.build('$builddir/spf.js', 'jscompiler', js_srcs,
              variables=[('flags', '$prod_jsflags $main_jsflags')],
              implicit=[jscompiler_jar, license_js])
  ninja.build('$builddir/debug-spf.js', 'jscompiler', js_srcs,
              variables=[('flags', '$debug_jsflags $main_jsflags')],
              implicit=[jscompiler_jar, license_js])
  ninja.build('$builddir/tracing-spf.js', 'jscompiler', js_srcs,
              variables=[('flags', '$trace_jsflags $main_jsflags'),
                         ('preamble', 'head -n 6 ' + wtf_shim)],
              implicit=[jscompiler_jar, license_js])
  ninja.newline()

  ninja.comment('Bootloader.')
  ninja.build('$builddir/bootloader.js', 'jscompiler', js_srcs,
              variables=[('flags', '$prod_jsflags $bootloader_jsflags')],
              implicit=[jscompiler_jar, license_js])
  ninja.build('$builddir/debug-bootloader.js', 'jscompiler', js_srcs,
              variables=[('flags', '$debug_jsflags $bootloader_jsflags')],
              implicit=[jscompiler_jar, license_js])
  ninja.build('$builddir/tracing-bootloader.js', 'jscompiler', js_srcs,
              variables=[('flags', '$trace_jsflags $bootloader_jsflags'),
                         ('preamble', 'head -n 6 ' + wtf_shim)],
              implicit=[jscompiler_jar, license_js])
  ninja.newline()

  ninja.comment('Development.')
  dev_out = '$builddir/dev-spf-bundle.js'
  ninja.build(dev_out, 'jscompiler', js_srcs,
              variables=[('flags', '$dev_jsflags $main_jsflags')],
              implicit=[jscompiler_jar, license_js])
  ninja.newline()

  ninja.comment('Tests.')
  js_tests = find_js_tests()
  jasmine_test_srcs = jasmine_zip_outs[1:]
  jasmine_test_outs = [
      '$builddir/test/jasmine.css',
      '$builddir/test/jasmine.js',
      '$builddir/test/jasmine-html.js',
  ]
  manifest_srcs = [dev_out] + js_tests
  manifest_out = '$builddir/test/manifest.js'
  test_outs = jasmine_test_outs + [manifest_out]
  runner_src = 'src/client/testing/runner.html'
  runner_out = '$builddir/test/runner.html'
  for test_src, test_out in zip(jasmine_test_srcs, jasmine_test_outs):
    ninja.build(test_out, 'symlink', test_src,
                variables=[('prefix', '../' * test_out.count('/'))])
  ninja.build(manifest_out, 'gen_test_manifest', manifest_srcs,
              variables=[('prefix', '../' * manifest_out.count('/'))])
  ninja.build(runner_out, 'symlink', runner_src,
              variables=[('prefix', '../' * runner_out.count('/'))],
              implicit=test_outs)
  ninja.newline()

  ninja.comment('Demo.')
  demo_srcs = find_demo_sources()
  demo_app_src = 'src/server/demo/app.py'
  demo_app_out = '$builddir/demo/app.py'
  demo_srcs.remove(demo_app_src)
  demo_outs = [s.replace('src/server/', '$builddir/') for s in demo_srcs]
  demo_srcs.append('vendor/webpy/web')
  demo_outs.append('$builddir/demo/web')
  demo_srcs.append(dev_out)
  demo_outs.append(dev_out.replace('$builddir/', '$builddir/demo/static/'))
  for demo_src, demo_out in zip(demo_srcs, demo_outs):
    ninja.build(demo_out, 'symlink', demo_src,
                variables=[('prefix', '../' * demo_out.count('/'))])
  ninja.build(demo_app_out, 'symlink', demo_app_src,
              variables=[('prefix', '../' * demo_app_out.count('/'))],
              implicit=demo_outs)
  ninja.newline()

  ninja.comment('Generate build file.')
  # Update the build file if this script or the build syntax changes.
  ninja.build('build.ninja', 'configure',
              implicit=[
                  './configure.py',
                  'vendor/ninja/misc/ninja_syntax.py',
              ])
  ninja.newline()


def write_aliases(ninja):
  ninja.comment('Aliases.')
  aliases = [
      ninja.build('spf', 'phony',
                  '$builddir/spf.js'),
      ninja.build('debug-spf', 'phony',
                  '$builddir/debug-spf.js'),
      ninja.build('tracing-spf', 'phony',
                  '$builddir/tracing-spf.js'),
      ninja.build('bootloader', 'phony',
                  '$builddir/bootloader.js'),
      ninja.build('debug-bootloader', 'phony',
                  '$builddir/debug-bootloader.js'),
      ninja.build('tracing-bootloader', 'phony',
                  '$builddir/tracing-bootloader.js'),
      ninja.build('tests', 'phony',
                  '$builddir/test/runner.html'),
      ninja.build('demo', 'phony',
                  '$builddir/demo/app.py'),
  ]
  aliases = [a for outs in aliases for a in outs]  # Reduce to a single list.
  ninja.newline()
  ninja.default('spf')
  ninja.build('all', 'phony', aliases)
  ninja.newline()


def main():
  check_requirements()
  ninja = create_ninja_file()
  write_header(ninja)
  write_variables(ninja)
  write_rules(ninja)
  write_targets(ninja)
  write_aliases(ninja)
  print('Wrote %s' % ninja.output.name)


if __name__ == '__main__':
  main()
