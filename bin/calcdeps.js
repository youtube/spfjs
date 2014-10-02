#!/usr/bin/env node

// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.


/**
 * @fileoverview Calculates Closure-style JavaScript dependencies without
 * requiring the Closure Compiler.  Functionally similar to calcdeps.py included
 * with Closure Library {@link https://github.com/google/closure-library}.
 *
 * @author nicksay@google.com (Alex Nicksay)
 */


// Library imports.
var minimist = require('minimist');
var path = require('path');
var q = require('q');
var fs = require('q-io/fs');
var wordwrap = require('wordwrap');
var util = require('util');


/**
 * Regular expression used to locate provided namespaces from source files.
 *
 * @type {RegExp}
 * @const
 */
var PROVIDES_REGEX = /goog\.provide\(['"](.+?)['"]\)/g;


/**
 * Regular expression used to locate required namespaces from source files.
 *
 * @type {RegExp}
 * @const
 */
var REQUIRES_REGEX = /goog\.require\(['"](.+?)['"]\)/g;


/**
 * Regular expression used to define namespaces on the command line.
 *
 * @type {RegExp}
 * @const
 */
var NAMESPACE_REGEX = /^ns:((\w+\.)*(\w+))$/;


/**
 * Regular expression used to identify JS files in a list.
 *
 * @type {RegExp}
 * @const
 */
var JSFILE_REGEX = /\.js$/i;


/**
 * Command line flags, with long options as keys and short options as values.
 *
 * @dict
 * @const
 */
var FLAGS = {
  help: 'h',
  path: 'p',
  mode: 'm'
};


/**
 * Descriptions of command line flags.
 *
 * @dict
 * @const
 */
var DESCRIPTIONS = {
  help: 'Show this help message and exit.',
  path: 'The path that should be traversed to build the dependencies. ' +
        'Repeat as needed for multiple paths.',
  mode: 'The type of output to generate either "list" for a list of ' +
        'filenames or "concat" for a single concatenated text ' +
        'containing the contents of all the files.'
};


/**
 * Defaults for command line flags, if applicable.
 *
 * @dict
 * @const
 */
var DEFAULTS = {
  path: '.',
  mode: 'list'
};



/**
 * Namespace for functions generic boolean tests on strings.
 */
var tests = {};


/**
 * See {@code NAMESPACE_REGEX}.
 *
 * @param {string} str String to test.
 * @return {boolean} Whether the string matches a command line argument for
 *     a namespace.
 */
tests.isNS = function(str) {
  return NAMESPACE_REGEX.test(str);
};


/**
 * See {@code JSFILE_REGEX}.
 *
 * @param {string} str String to test.
 * @return {boolean} Whether the string matches a JS file (and not namespace).
 */
tests.isJS = function(str) {
  return !tests.isNS(str) && JSFILE_REGEX.test(str);
};



/**
 * Namespace for functions to handle arrays.
 */
var arrays = {};


/**
 * Flattens a N-level array to a 1-level array by recursively concatening
 * all the items.  A new array object will be returned.
 *
 * @param {Array} arr An array.
 * @return {Array} A new, flattened 1-level array.
 */
arrays.flatten = function(arr) {
  if (!util.isArray(arr)) {
    return [arr];
  }
  return arr.reduce(function(prev, cur) {
      return prev.concat(arrays.flatten(cur));
  }, []);
};


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
 * Filters an array to only include JS files.  See {@link tests.isJS}.
 * A new array object will be returned.
 *
 * @param {Array} arr The array to filter.
 * @return {Array} A new array with only JS files.
 */
arrays.filterJS = function(arr) {
  return arr.filter(function(val, idx, arr) {
    return tests.isJS(val);
  });
};



/**
 * Namespace for functions to handle files.
 */
var files = {};


/**
 * Returns a promise for a list of all JS files in a directory and all
 * subdirectories it contains.  Namespaces (e.g. those provided by command-line
 * argument are returned as-is.)
 *
 * @param {string} path String of a file or directory path, or a namespace.
 * @return {Promise.<Array.<string>>}
 */
files.tree = function(path) {
  if (!path) {
    return q.fcall(function() { return []; });
  }
  if (tests.isNS(path)) {
    return q.fcall(function() { return [path]; });
  }
  return fs.listTree(path, tests.isJS);
};


/**
 * Returns a promise for a list of lists of JS files or namespaces.  One list
 * is returned, where each item might be JS file or namespace, or it might be
 * an array of JS files or namespaces (meaning a 1-level or 2-level array is
 * returned).  See {@link files.tree}.
 *
 * @param {string|Array.<string>} paths One or more strings of file paths,
 *     directory paths, or namespaces.
 * @return {Promise.<Array.<Array|string>>}
 */
files.list = function(paths) {
  if (util.isArray(paths)) {
    return q.all(paths.map(files.find));
  }
  return files.tree(paths);
};


/**
 * Returns a promise for a list of all JS files or namespaces specified by
 * by one or more paths (meaning a 1-level array with all duplicates removed is
 * returned).  The paths may be files, directories, or namespaces themselves.
 * If a given path is a directory, all JS files in the directory or any
 * subdirectory are returned.  See {@link files.list} and {@link files.tree}.
 *
 * @param {string|Array.<string>} paths One or more strings of file paths,
 *     directory paths, or namespaces.
 * @return {Promise.<Array.<string>>}
 */
files.find = function(paths) {
  return files.list(paths)
      .then(arrays.flatten)
      .then(arrays.unique);
};



/**
 * Namespace for functions to handle dependencies.
 */
var deps = {};


/**
 * Simple container object for JS source file dependency information.
 *
 * @param {string} path The path to the JS source file.
 * @param {string} content The text of the JS source file.
 * @constructor
 * @struct
 */
deps.Info = function(path, content) {
  this.path = path;
  this.content = content;
  this.provides = [];
  this.requires = [];
};


/**
 * @return {string} A text representation of the dependency information.
 * @override
 */
deps.Info.prototype.toString = function() {
  return util.format('%s (provides: %s) (requires: %s)',
                     this.path, this.provides, this.requires);
};


/**
 * Returns a promise to read a JS source file's contents and create an
 * unpopulated dependency information object for it.  See {@link deps.Info}.
 *
 * @param {string} path The path to the JS source file.
 * @return {Promise.<deps.Info>}
 */
deps.create = function(path) {
  return fs.read(path).then(function(content) {
    return new deps.Info(path, content);
  });
}


/**
 * Returns a promise to return an array of unpopulated dependency information
 * objects, one for every JS source file path in the array provided.
 * A new array object will be returned.  See {@link deps.create}.
 *
 * @param {Array.<string>} paths Array of strings of file paths.
 * @return {Promise.<Array.<deps.Info>>}
 */
deps.read = function(paths) {
  paths = arrays.unique(arrays.filterJS(paths));
  return q.all(paths.map(deps.create));
};


/**
 * Extracts and populates provide and require information for every dependency
 * information object in the array provided.  A new array object will be
 * returned.  See {@code PROVIDES_REGEX} and {@code REQUIRES_REGEX}.
 *
 * @param {Array.<deps.Info>} infos Array of dependency information objects.
 * @return {Array.<deps.Info>}
 */
deps.extract = function(infos) {
  return infos.map(function(info) {
    var tmp;
    while (tmp = PROVIDES_REGEX.exec(info.content)) {
      info.provides.push(tmp[1]);
    }
    while (tmp = REQUIRES_REGEX.exec(info.content)) {
      info.requires.push(tmp[1]);
    }
    return info;
  });
};


/**
 * Builds a dependency map from an array of populated dependency objects, where
 * the resulting map keys are both JS file paths and provided namespaces and
 * the map values are the dependency information objects.
 *
 * @param {Array.<deps.Info>} infos Array of dependency information objects.
 * @return {Object.<deps.Info>}
 */
deps.build = function(infos) {
  var hash = {};
  infos.forEach(function(info) {
    // Add the path to the map.
    hash[info.path] = info;
    // Add each provided namespace from that file to the map.
    info.provides.forEach(function(ns) {
      if (ns in hash) {
        util.error(util.format(
            'Duplicate provide for "%s" in %s and %s.',
            ns, info.path, hash[ns].path));
        process.exit(1);
      }
      hash[ns] = info;
    });
  });
  return hash;
};


/**
 * Recursively resolves all required dependecies for a given dependecy
 * information object using the provided dependency map.  The "resolved"
 * dependency information objects are added to the provided array in dependency
 * order.  See {@link deps.build}.
 *
 * @param {deps.Info} info The dependency information object to resolve.
 * @param {Object.<deps.Info>} hash The dependency map.
 * @param {Array.<deps.Info>} ordered The resolved dependency information
 *     objects in depdency order.
 * @param {Object.<boolean>} seen A map marking whether a file has already been
 *     required during the resolve process.
 */
deps.resolve = function(info, hash, ordered, seen) {
  info.requires.forEach(function(ns) {
    if (!(ns in hash)) {
      util.error(util.format(
          'Missing provide for "%s" required by %s.',
          ns, info.path));
      process.exit(1);
    }
    var depInfo = hash[ns];
    if (!seen[depInfo.path]) {
      seen[depInfo.path] = true;
      deps.resolve(depInfo, hash, ordered, seen);
      ordered.push(depInfo);
    }
  });
};


/**
 * For a list of inputs (either namespaces or file paths) and a provided
 * dependency map, return an array of dependecy information objects in
 * dependency order.  See {@link deps.resolve}.
 *
 * @param {Object.<deps.Info>} hash The dependency map.
 * @param {Array.<string>} inputs [description]
 * @return {[type]}
 */
deps.order = function(hash, inputs) {
  var ordered = [];
  var seen = {};
  inputs.forEach(function(input) {
    var info;
    if (tests.isNS(input)) {
      var ns = NAMESPACE_REGEX.exec(input)[1];
      if (!(ns in hash)) {
        util.error(util.format('Missing input namespace "%s".', ns));
        process.exit(1);
      }
      info = hash[ns];
    } else {
      if (!(input in hash)) {
        util.error(util.format('Missing input file "%s".', input));
        process.exit(1);
      }
      info = hash[input];
    }
    deps.resolve(info, hash, ordered, seen);
    ordered.push(info);
  });
  return ordered;
};


/**
 * Returns a promise to return a list of ordered dependency information objects.
 *
 * @param {Array.<string>} paths Array of file paths or namespaces to read and
 *     parse for dependecies.
 * @param {Array.<string>} inputs Array of file paths or namespaces to use as
 *     the "start" when creating the ordered dependencies.
 * @return {Promise.<Array.<deps.Info>>}
 */
deps.calculate = function(paths, inputs) {
  var combined = paths.concat(inputs);
  return deps.read(combined)
      .then(deps.extract)
      .then(deps.build)
      .then(function(hash) { return deps.order(hash, inputs); });
};



/**
 * Namespace for functions to handle the command line interface.
 */
var cli = {};


/**
 * Parses the command line arguments for flags and values.
 * @return {object}
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
      'Usage: %s [options] argument [arguments]', program));
  util.puts('');
  var wrap = wordwrap(78);
  util.puts('Arguments:')
  util.puts(wrap('The inputs to calculate dependencies for: files, ' +
                 'directories, or namespaces (e.g. "ns:my.project").'));
  util.puts('');
  wrap = wordwrap(8, 78);
  util.puts('Options:');
  for (var flag in FLAGS) {
    util.puts(util.format('--%s, -%s', flag, FLAGS[flag]));
    util.puts(wrap(DESCRIPTIONS[flag]))
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

  if (args.length < 1 || opts.help) {
    cli.help();
    process.exit();
  }

  files.find(opts.path).then(function(paths) {
    files.find(args).then(function(inputs) {
      deps.calculate(paths, inputs).then(function(infos) {
        if (opts.mode == 'list') {
          util.puts.apply(null, infos.map(function(info) {
            return info.path;
          }));
        } else if (opts.mode == 'concat') {
          util.puts.apply(null, infos.map(function(info) {
            return info.content;
          }));
        } else {
          util.error('Unknown output mode');
          process.exit(1);
        }
      });
    });
  });
}


main();
