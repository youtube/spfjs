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
  childProcess: require('child_process'),
  name: require('./name'),
  glob: require('glob'),
  ninjaBuildGen: require('ninja-build-gen'),
  path: require('path'),
  phantomjs: require('phantomjs'),
  semver: require('semver'),
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


/**
 * Namespace for functions to handle strings.
 */
var strings = {};


/**
 * Repeats a string a given number of times.
 *
 * @param {string} str The string to repeat
 * @param {number} count The number of times to repeat.
 * @return {string}
 */
strings.repeat = function(str, count) {
  var s = '';
  for (var i = 0; i < count; i++) {
    s += str;
  }
  return s;
};


function requirements() {
  // Closure Compiler after v20131014 requires Java 7.
  var required = $.semver('1.7.0');
  $.childProcess.exec('java -version', function(error, stdout, stderr) {
    if (error || !stderr) {
      $.util.error([
            'Unable to get java version.',
            'Please install java before building.',
          ].join('\n'));
      process.exit(1);
    }
    var version;
    var installed;
    try {
      version = stderr.split('\n')[0].split(' ').slice(-1)[0].replace(/"/g, '');
      // Replace underscores to make Java's version string semver-compatible.
      installed = $.semver.parse(version.replace('_', '-'));
    } catch (ex) {}
    if (!installed || installed < required) {
      $.util.error($.util.format([
            'Installed java version "%s" is less than the required "%s".',
            'Please upgrade java before building.'
          ].join('\n'), installed, required));
      process.exit(1);
    }
  });
}


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
               'third-party/phantomjs/examples/run-jasmine2.js');
  ninja.assign('gjslint_py',
               'node_modules/closure-linter-wrapper/tools/gjslint.py')
  ninja.assign('fixjsstyle_py',
               'node_modules/closure-linter-wrapper/tools/fixjsstyle.py')
  // Files.
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
    '--define "SPF_BOOTLOADER=true"',
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
    jslint: 'python $gjslint_py $flags $in',
    jsfix: 'python $fixjsstyle_py $flags $in',
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

  // jslint: Check JS files for style issues.
  ninja.rule('jslint')
      .run(cmds.jslint)
      .description('jslint $in');

  // jsfix: Automatically fix JS files for style issues.
  ninja.rule('jsfix')
      .run(cmds.jsfix)
      .description('jsfix $in');

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

  var globs = {
    tests: 'src/client/**/*_test.js',
    server: 'src/server/python/**/*.*',
    demo: 'src/server/demo/**/*.*',
    webpy: 'bower_components/webpy/web/**/*.py'
  };

  var libs = {
    webpy: $.glob.sync(globs.webpy)
  };

  // Find source files.
  var opts = {path: ['src/client/', 'third-party/']};
  // Prepend the stub file since Closure Library isn't used.
  var stub = 'src/client/stub.js';
  var srcs = {
    main: $.calcdeps(opts, [stub, 'ns:spf.main']),
    bootloader: $.calcdeps(opts, [stub, 'ns:spf.bootloader']),
    tests: $.calcdeps(opts, [stub].concat($.glob.sync(globs.tests))),
    server: $.glob.sync(globs.server),
    demo: $.glob.sync(globs.demo)
  };

  // Use all files for monitoring when the build file needs to be updated.
  var all = arrays.unique(['bin/configure.js', 'package.json']
      .concat(srcs.main)
      .concat(srcs.bootloader)
      .concat(srcs.tests)
      .concat(srcs.server)
      .concat(srcs.demo)
      );

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

  // Development bundle.
  ninja.edge('$builddir/dev-spf-bundle.js')
      .using('jscompile')
      .from(srcs.main)
      .need(files.jscompiler, files.license)
      .assign('flags', '$dev_jsflags');

  // Tests.
  ninja.edge('$builddir/test/manifest.js')
      .using('manifest')
      .from(srcs.tests)
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine.css')
      .using('symlink')
      .from('bower_components/jasmine-core/lib/jasmine-core/jasmine.css')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine.js')
      .using('symlink')
      .from('bower_components/jasmine-core/lib/jasmine-core/jasmine.js')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine-html.js')
      .using('symlink')
      .from('bower_components/jasmine-core/lib/jasmine-core/jasmine-html.js')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/jasmine-boot.js')
      .using('symlink')
      .from('bower_components/jasmine-core/lib/jasmine-core/boot.js')
      .assign('prefix', '../../');

  ninja.edge('$builddir/test/runner.html')
      .using('symlink')
      .from('src/client/testing/runner.html')
      .need(srcs.tests.concat([
            '$builddir/test/manifest.js',
            '$builddir/test/jasmine.css',
            '$builddir/test/jasmine.js',
            '$builddir/test/jasmine-html.js',
            '$builddir/test/jasmine-boot.js'
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

  // Demo.
  var outs = {demo: []};

  // Remove the app.py file from the sources list, as it depends on the others.
  srcs.demo.splice(srcs.demo.indexOf('src/server/demo/app.py'), 1);

  // Symlink each demo source and library file into the build directory.
  (srcs.demo.concat(srcs.server).concat(libs.webpy)).forEach(function(src) {
    var out = src.replace('src/server/demo/', '$builddir/demo/')
        .replace('src/server/python/', '$builddir/demo/')
        .replace('bower_components/webpy/', '$builddir/demo/');
    var depth = (out.match(/\//g) || []).length;
    ninja.edge(out)
        .using('symlink')
        .from(src)
        .assign('prefix', strings.repeat('../', depth));
    outs.demo.push(out);
  });

  // Include the main sources for uncompiled development.
  srcs.main.forEach(function(src) {
    var out = '$builddir/demo/static/dev/' + src;
    var depth = (out.match(/\//g) || []).length;
    ninja.edge(out)
        .using('symlink')
        .from(src)
        .assign('prefix', strings.repeat('../', depth));
    outs.demo.push(out);
  });
  // Create a manifest
  ninja.edge('$builddir/demo/static/dev/manifest.js')
      .using('manifest')
      .from(srcs.main)
      .assign('prefix', '/static/dev/');
  outs.demo.push('$builddir/demo/static/dev/manifest.js');

  // Finally, symlink the app.py file as well, declaring the deps.
  ninja.edge('$builddir/demo/app.py')
      .using('symlink')
      .from('src/server/demo/app.py')
      .need(outs.demo.concat(['bower_components/webpy/web']))
      .assign('prefix', '../../');

  // Build file updates.
  ninja.edge('build.ninja')
      .using('configure')
      .need(all);
}


function aliases(ninja) {
  // Define special files used in both rules and targets.
  var files = {
    fixjsstyle: '$fixjsstyle_py',
    gjslint: '$gjslint_py',
    jasmine: '$jasmine_js'
  };

  // Tools.
  ninja.edge('test')
      .using('jasmine')
      .from('$builddir/test/runner.html')
      .need(files.jasmine);

  ninja.edge('lint')
      .using('jslint')
      .from('src/client')
      .need(files.gjslint)
      .assign('flags', '--recurse');

  ninja.edge('fix')
      .using('jsfix')
      .from('src/client')
      .need(files.fixjsstyle)
      .assign('flags', '--recurse');

  // Shortcuts.
  ninja.edge('spf')
      .using('phony')
      .from('$builddir/spf.js');

  ninja.edge('spf-debug')
      .using('phony')
      .from('$builddir/spf-debug.js');

  ninja.edge('spf-trace')
      .using('phony')
      .from('$builddir/spf-trace.js');

  ninja.edge('boot')
      .using('phony')
      .from('$builddir/boot.js');

  ninja.edge('boot-debug')
      .using('phony')
      .from('$builddir/boot-debug.js');

  ninja.edge('boot-trace')
      .using('phony')
      .from('$builddir/boot-trace.js');

  ninja.edge('dev')
      .using('phony')
      .from('$builddir/dev-spf-bundle.js');

  ninja.edge('tests')
      .using('phony')
      .from('$builddir/test/runner.html');

  ninja.edge('demo')
      .using('phony')
      .from('$builddir/demo/app.py');

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

  // The "all" shortcut does not include the distribution files.
  ninja.edge('all')
      .using('phony')
      .from([
            '$builddir/spf.js',
            '$builddir/spf-debug.js',
            '$builddir/spf-trace.js',
            '$builddir/boot.js',
            '$builddir/boot-debug.js',
            '$builddir/boot-trace.js',
            '$builddir/dev-spf-bundle.js',
            '$builddir/test/runner.html',
            '$builddir/demo/app.py'
          ]);

  // Default.
  ninja.byDefault('spf');
}


/**
 * The main program execution function.
 */
function main() {
  requirements();
  var ninja = $.ninjaBuildGen('1.4');
  header(ninja);
  variables(ninja);
  rules(ninja);
  targets(ninja);
  aliases(ninja);
  ninja.save('build.ninja');
  console.log('Wrote build.ninja');
}


main();
