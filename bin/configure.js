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
  path: require('path'),
  ninjaBuildGen: require('ninja-build-gen'),
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
  ninja.header(lines.join('\n'))
}


function variables(ninja) {
  // Basic directories.
  ninja.assign('builddir', 'build');
  ninja.assign('distdir', 'dist');
  // Tools.
  ninja.assign('jscompiler_jar',
               'bower_components/closure-compiler/compiler.jar');
  ninja.assign('license_js', 'src/license.js');
  ninja.assign('preamble_file', '');
  ninja.assign('preamble_length', '6');
  ninja.assign('wrapper_js', 'src/wrapper.js');
  ninja.assign('package_json', './package.json');
  ninja.assign('filter_cmd', 'cat');
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
  ninja.assign('prod_jsflags', prod.join(' '))
  ninja.assign('debug_jsflags', debug.join(' '))
  ninja.assign('trace_jsflags', trace.join(' '))
  ninja.assign('dev_jsflags', dev.join(' '))
  ninja.assign('main_jsflags', main.join(' '))
  ninja.assign('bootloader_jsflags', bootloader.join(' '))
}


function rules(ninja) {
  // Generate the build file.
  ninja.rule('configure')
      .run('./bin/configure.js')
      .description('configure')
      .generator(true);

  // Build JS files.
  var jscompilecmd = [
    'cat $license_js > $out',
    '&& (',
    '  [[ "$preamble_file" ]] &&',
    '  head -n $preamble_length $preamble_file >> $out',
    '  || true;',
    ')',
    '&& java -jar $jscompiler_jar $flags $in >> $out',
    '|| (rm $out; false)'
  ].join(' ');
  ninja.rule('jscompile')
      .run(jscompilecmd)
      .description('jscompile $out');
}


function targets(ninja) {
  var files = {
    jscompiler: '$jscompiler_jar',
    license: '$license_js',
    preamble: 'third-party/tracing-framework/shims/wtf-trace-closure.js',
    wrapper: '$wrapper_js'
  };
  // Find source files.
  var opts = {path: ['src/client/', 'third-party/']};
  var srcs = {
    main: $.calcdeps('ns:spf.main', opts),
    bootloader: $.calcdeps('ns:spf.bootloader', opts)
  };
  // Prepend the stub file since Closure Library isn't used.
  srcs.main.unshift('src/client/stub.js');
  srcs.bootloader.unshift('src/client/stub.js');
  // Use a complete set for monitoring when this file needs to be updated.
  srcs.all = arrays.unique(srcs.main.concat(srcs.bootloader));

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

  // Build file updates.
  ninja.edge('build.ninja')
      .using('configure')
      .need(srcs.all.concat(['./bin/configure.js']));
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
  ninja.save('build.ninja');
  $.util.puts('Wrote build.ninja');
}


main();
