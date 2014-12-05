#!/usr/bin/env node

// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.


/**
 * @fileoverview Script that generates the build.ninja file for SPF.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// Library imports.
var $ = {
  calcdeps: require('./calcdeps'),
  name: require('./name'),
  glob: require('glob'),
  ninjaBuildGen: require('ninja-build-gen'),
  path: require('path'),
  phantomjs: require('phantomjs'),
  util: require('util')
};


/**
 * Namespace for functions to handle arrays.
 */
var arrays = {};


/**
 * Filters an array to remove duplicate items so that only unique values remain.
 * A new array object will be returned.
 *
 * @param {Array} arr The array to filter.
 * @return {Array} A new array with only unique values.
 */
arrays.unique = function(arr) {
  return arr.filter(function(val, idx, arr) {
    return arr.indexOf(val) == idx;
  });
};


function header(ninja) {
  var lines = [
    '# Copyright 2014 Google Inc. All rights reserved.',
    '#',
    '# Use of this source code is governed by The MIT License.',
    '# See the LICENSE file for details.',
    '#',
    '# This generated file is used to build SPF.',
    '# To update, run ' + $.path.basename(__filename)
  ];
  ninja.header(lines.join('\n'));
}


function variables(ninja) {
  // Basic directories.
  ninja.assign('builddir', 'build');
  ninja.assign('distdir', 'dist');
  // Tools.
  ninja.assign('jscompiler_jar',
               'bower_components/closure-compiler/compiler.jar');
  ninja.assign('jasmine_js',
               'third-party/phantomjs/examples/run-jasmine.js');
  ninja.assign('license_js', 'src/license.js');
  ninja.assign('preamble_file', '');
  ninja.assign('preamble_length', '6');
  ninja.assign('wrapper_js', 'src/wrapper.js');
  ninja.assign('name_and_ver', $.name());
  // Flags.
  var common = [
    '--compilation_level ADVANCED_OPTIMIZATIONS',
    '--define "COMPILED=true"',
    '--manage_closure_dependencies true',
    '--process_closure_primitives true'
  ];
  var prod = common.concat([
    '--define "SPF_DEBUG=false"',
    '--summary_detail_level 3',
    '--warning_level VERBOSE',
    '--jscomp_error accessControls',
    '--jscomp_error ambiguousFunctionDecl',
    '--jscomp_error checkEventfulObjectDisposal',
    '--jscomp_error checkRegExp',
    '--jscomp_error checkStructDictInheritance',
    '--jscomp_error checkTypes',
    '--jscomp_error checkVars',
    '--jscomp_error const',
    '--jscomp_error constantProperty',
    '--jscomp_error deprecated',
    '--jscomp_error duplicateMessage',
    '--jscomp_error es3',
    '--jscomp_error es5Strict',
    '--jscomp_error externsValidation',
    '--jscomp_error fileoverviewTags',
    '--jscomp_error globalThis',
    '--jscomp_error internetExplorerChecks',
    '--jscomp_error invalidCasts',
    '--jscomp_error misplacedTypeAnnotation',
    '--jscomp_error missingGetCssName',
    '--jscomp_error missingProperties',
    '--jscomp_error missingProvide',
    '--jscomp_error missingRequire',
    '--jscomp_error missingReturn',
    '--jscomp_error newCheckTypes',
    '--jscomp_error nonStandardJsDocs',
    '--jscomp_error suspiciousCode',
    '--jscomp_error strictModuleDepCheck',
    '--jscomp_error typeInvalidation',
    '--jscomp_error undefinedNames',
    '--jscomp_error undefinedVars',
    '--jscomp_error unknownDefines',
    '--jscomp_error uselessCode',
    '--jscomp_error useOfGoogBase',
    '--jscomp_error visibility'
  ]);
  var debug = common.concat([
    '--debug true',
    '--formatting PRETTY_PRINT'
  ]);
  var trace = common.concat([
    '--define "SPF_DEBUG=false"',
    '--define "SPF_TRACING=true"'
  ]);
  var dev = [
    '--compilation_level WHITESPACE_ONLY',
    '--formatting PRETTY_PRINT',
    '--manage_closure_dependencies true',
    '--closure_entry_point spf.main'
  ];
  var main = [
    '--closure_entry_point spf.main',
    '--output_wrapper_file $wrapper_js'
  ];
  var bootloader = [
    '--closure_entry_point spf.bootloader',
    '--output_wrapper "(function(){%output%})();"'
  ];
  ninja.assign('prod_jsflags', prod.join(' '));
  ninja.assign('debug_jsflags', debug.join(' '));
  ninja.assign('trace_jsflags', trace.join(' '));
  ninja.assign('dev_jsflags', dev.join(' '));
  ninja.assign('main_jsflags', main.join(' '));
  ninja.assign('bootloader_jsflags', bootloader.join(' '));
}


function rules(ninja) {
  var cmds = {
    configure: 'bin/configure.js',
    jasmine: $.phantomjs.path + ' $jasmine_js $in',
    jscompile: [
          'cat $license_js > $out',
          '&& (',
          '  [[ "$preamble_file" ]] &&',
          '  head -n $preamble_length $preamble_file >> $out',
          '  || true',
          ') ',
          '&& java -jar $jscompiler_jar $flags $in >> $out',
          '|| (rm $out; false)'
        ].join(' '),
    jsdist: 'cat $in | sed "2 s/SPF/$name_and_ver/" > $out',
    manifest: [
          'echo $in',
          '| tr " " "\\n"',
          '| sed "s,^,document.write(\'<script src=\\"$prefix,g"',
          '| sed "s,$$,\\"></script>\');,g"',
          '> $out'
        ].join(' '),
    symlink: 'ln -sf $prefix$in $out'
  };

  // configure: Generate the build file.
  ninja.rule('configure')
      .run(cmds.configure)
      .description('configure')
      .generator(true);

  // jasmine: Run JS tests.
  ninja.rule('jasmine')
      .run(cmds.jasmine)
      .description('jasmine $in');

  // jscompile: Compile JS output.
  ninja.rule('jscompile')
      .run(cmds.jscompile)
      .description('jscompile $out');

  // jsdist: Update JS output with release name/version.
  ninja.rule('jsdist')
      .run(cmds.jsdist)
      .description('jsdist $out');

  // manifest: Generate the test manifest.
  ninja.rule('manifest')
      .run(cmds.manifest)
      .description('manifest $out');

  // symlink: Symlink files.
  ninja.rule('symlink')
      .run(cmds.symlink)
      .description('symlink $prefix$in -> $out');
}


function targets(ninja) {
  // Define special files used in both rules and targets.
  var files = {
    jscompiler: '$jscompiler_jar',
    license: '$license_js',
    preamble: 'third-party/tracing-framework/shims/wtf-trace-closure.js',
    wrapper: '$wrapper_js'
  };

  // Find source files.
  var opts = {path: ['src/client/', 'third-party/']};
  var srcs = {
    main: $.calcdeps(opts, 'ns:spf.main'),
    bootloader: $.calcdeps(opts, 'ns:spf.bootloader')
  };
  // Find test files.
  var tests = $.calcdeps(opts, $.glob.sync('src/client/**/*_test.js'));
  // Prepend the stub file since Closure Library isn't used.
  srcs.main.unshift('src/client/stub.js');
  srcs.bootloader.unshift('src/client/stub.js');
  tests.unshift('src/client/stub.js');

  // Use all files for monitoring when the build file needs to be updated.
  var all = arrays.unique(srcs.main.concat(srcs.bootloader).concat(tests));

  // Main.
  ninja.edge('$builddir/spf.js')
      .using('jscompile')
      .from(srcs.main)
      .need([files.jscompiler, files.license, files.wrapper])
      .assign('flags', '$prod_jsflags $main_jsflags');

  ninja.edge('$builddir/spf-debug.js')
      .using('jscompile')
      .from(srcs.main)
      .need([files.jscompiler, files.license, files.wrapper])
      .assign('flags', '$debug_jsflags $main_jsflags');

  ninja.edge('$builddir/spf-trace.js')
      .using('jscompile')
      .from(srcs.main)
      .need([files.jscompiler, files.license, files.wrapper, files.preamble])
      .assign('flags', '$trace_jsflags $main_jsflags')
      .assign('preamble_file', files.preamble);

  // Bootloader.
  ninja.edge('$builddir/boot.js')
      .using('jscompile')
      .from(srcs.bootloader)
      .need([files.jscompiler, files.license])
      .assign('flags', '$prod_jsflags $bootloader_jsflags');

  ninja.edge('$builddir/boot-debug.js')
      .using('jscompile')
      .from(srcs.bootloader)
      .need([files.jscompiler, files.license])
      .assign('flags', '$debug_jsflags $bootloader_jsflags');

  ninja.edge('$builddir/boot-trace.js')
      .using('jscompile')
      .from(srcs.bootloader)
      .need([files.jscompiler, files.license, files.preamble])
      .assign('flags', '$trace_jsflags $bootloader_jsflags')
      .assign('preamble_file', files.preamble);

  // Development.
  ninja.edge('$builddir/dev-spf-bundle.js')
      .using('jscompile')
      .from(srcs.main)
      .need(files.jscompiler, files.license)
      .assign('flags', '$dev_jsflags');

  // Tests.
  ninja.edge('$builddir/test/manifest.js')
      .using('manifest')
      .from(tests)
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine.css')
      .using('symlink')
      .from('bower_components/jasmine/lib/jasmine-1.3.1/jasmine.css')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine.js')
      .using('symlink')
      .from('bower_components/jasmine/lib/jasmine-1.3.1/jasmine.js')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine-html.js')
      .using('symlink')
      .from('bower_components/jasmine/lib/jasmine-1.3.1/jasmine-html.js')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/runner.html')
      .using('symlink')
      .from('src/client/testing/runner.html')
      .need(tests.concat([
            '$builddir/test/manifest.js',
            '$builddir/test/jasmine.css',
            '$builddir/test/jasmine.js',
            '$builddir/test/jasmine-html.js'
          ]))
      .assign('prefix', '../../');

  // Distribution.
  ninja.edge('$distdir/spf.js')
      .using('jsdist')
      .from('$builddir/spf.js');

  ninja.edge('$distdir/spf-debug.js')
      .using('jsdist')
      .from('$builddir/spf-debug.js');

  ninja.edge('$distdir/spf-trace.js')
      .using('jsdist')
      .from('$builddir/spf-trace.js');

  ninja.edge('$distdir/boot.js')
      .using('jsdist')
      .from('$builddir/boot.js');

  ninja.edge('$distdir/boot-debug.js')
      .using('jsdist')
      .from('$builddir/boot-debug.js');

  ninja.edge('$distdir/boot-trace.js')
      .using('jsdist')
      .from('$builddir/boot-trace.js');

  // Build file updates.
  ninja.edge('build.ninja')
      .using('configure')
      .need(all.concat(['bin/configure.js', 'package.json']));
}


function aliases(ninja) {
  // Define special files used in both rules and targets.
  var files = {
    jasmine: '$jasmine_js'
  };

  // Tools.
  ninja.edge('test')
      .using('jasmine')
      .from('$builddir/test/runner.html')
      .need(files.jasmine);

  // Shortcuts.
  ninja.edge('dist')
      .using('phony')
      .from([
            '$distdir/spf.js',
            '$distdir/spf-debug.js',
            '$distdir/spf-trace.js',
            '$distdir/boot.js',
            '$distdir/boot-debug.js',
            '$distdir/boot-trace.js'
          ]);
  ninja.edge('tests')
      .using('phony')
      .from('$builddir/test/runner.html');
}


/**
 * The main program execution function.
 */
function main() {
  var ninja = $.ninjaBuildGen('1.4');
  header(ninja);
  variables(ninja);
  rules(ninja);
  targets(ninja);
  aliases(ninja);
  ninja.save('build.ninja');
  $.util.puts('Wrote build.ninja');
}


main();
