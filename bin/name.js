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
var fs = require('fs');
var minimist = require('minimist');
var path = require('path');
var semver = require('semver');
var util = require('util');
var wordwrap = require('wordwrap');


/**
 * Command line flags, with long options as keys and short options as values.
 *
 * @dict
 * @const
 */
var FLAGS = {
  help: 'h',
  path: 'p',
  semver: 's'
};


/**
 * Descriptions of command line flags.
 *
 * @dict
 * @const
 */
var DESCRIPTIONS = {
  help: 'Show this help message and exit.',
  path: 'The path to the "package.json" file to parse.',
  semver: 'Print just the semver valid version number.'
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
 * Parses the command line arguments for flags and values.
 * @return {Object}
 */
cli.parse = function() {
  return minimist(process.argv.slice(2), {
    alias: FLAGS,
    default: DEFAULTS
  });
};


/**
 * Prints the help information for the command line interface.
 */
cli.help = function() {
  var program = path.basename(process.argv[1]);
  util.puts(util.format(
      'Usage: %s [options]', program));
  util.puts('');
  wrap = wordwrap(8, 78);
  util.puts('Options:');
  for (var flag in FLAGS) {
    util.puts(util.format('--%s, -%s', flag, FLAGS[flag]));
    util.puts(wrap(DESCRIPTIONS[flag]));
    if (flag in DEFAULTS) {
      util.puts(wrap('Default: ' + DEFAULTS[flag]));
    }
  }
};


/**
 * The main program execution function.
 */
function main() {

  var opts = cli.parse();
  var args = opts._;

  if (opts.help) {
    cli.help();
    process.exit();
  }

  var manifest = JSON.parse(fs.readFileSync(opts.path, 'utf8'));
  var version = semver.valid(manifest.version) || '';

  if (opts.semver) {
    util.puts(version);
    process.exit();
  }

  var name = version.split('.').slice(0, 2).join('');
  var fmt = (version && name) ? 'SPF %s (v%s)' : 'SPF';
  util.puts(util.format(fmt, name, version));
}


main();
