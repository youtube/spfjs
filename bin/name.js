#!/usr/bin/env node

// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.


/**
 * @fileoverview Prints the SPF name and version number to standard out.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// Library imports.
var $ = {
  fs: require('fs'),
  minimist: require('minimist'),
  path: require('path'),
  semver: require('semver'),
  util: require('util'),
  wordwrap: require('wordwrap')
};


/**
 * Command line flags, with long options as keys and short options as values.
 *
 * @dict
 * @const
 */
var FLAGS = {
  help: 'h',
  name: 'n',
  path: 'p',
  version: 'v'
};


/**
 * Descriptions of command line flags.
 *
 * @dict
 * @const
 */
var DESCRIPTIONS = {
  help: 'Show this help message and exit.',
  name: 'Print just the name.',
  path: 'The path to the "package.json" file to parse.',
  version: 'Print just the version number.'
};


/**
 * Defaults for command line flags, if applicable.
 *
 * @dict
 * @const
 */
var DEFAULTS = {
  path: 'package.json'
};


/**
 * Namespace for functions to handle the command line interface.
 */
var cli = {};


/**
 * Whether the script is being executed via command line.
 *
 * @type {boolean}
 */
cli.active = !module.parent;


/**
 * Parses the command line arguments for flags and values.
 * @return {Object}
 */
cli.parse = function() {
  return $.minimist(process.argv.slice(2), {
    alias: FLAGS,
    default: DEFAULTS
  });
};


/**
 * Prints the help information for the command line interface.
 */
cli.help = function() {
  var program = $.path.basename(process.argv[1]);
  console.log($.util.format(
      'Usage: %s [options]', program));
  console.log('');
  wrap = $.wordwrap(8, 78);
  console.log('Options:');
  for (var flag in FLAGS) {
    console.log($.util.format('--%s, -%s', flag, FLAGS[flag]));
    console.log(wrap(DESCRIPTIONS[flag]));
    if (flag in DEFAULTS) {
      console.log(wrap('Default: ' + DEFAULTS[flag]));
    }
  }
};


/**
 * The main execution function.
 */
function main(opts, args) {
  if (cli.active) {
    // If this is a command-line invocation, parse the args and opts.  If the
    // help opt is given, print the help and exit.
    opts = cli.parse();
    args = opts._;
    if (opts.help) {
      cli.help();
      process.exit();
    }
  } else {
    // Create defaults for options if not provided.
    opts = opts || {};
    for (var d in DEFAULTS) {
      if (!(d in opts)) {
        opts[d] = DEFAULTS[d];
      }
    }
  }

  // Parse the manifest file.
  var manifest = JSON.parse($.fs.readFileSync(opts.path, 'utf8'));

  // Extract and validate the version.
  var version = $.semver.valid(manifest.version) || '';

  // Format the output.
  var output;
  if (opts.version) {
    output = version;
  } else {
    var num = version.split('.').slice(0, 2).join('');
    var name = $.util.format((num ? '%s %s' : '%s'), 'SPF', num);
    if (opts.name) {
      output = name;
    } else {
      output = $.util.format((version ? '%s (v%s)' : '%s'), name, version);
    }
  }

  // Print the output to stdout, if needed (for the command-line).
  if (cli.active) {
    console.log(output);
  }

  // Return the output (for the module).
  return output;
}


// Provide a module function.
module.exports = main;


// Automatically execute if called directly.
if (cli.active) {
  main();
}
