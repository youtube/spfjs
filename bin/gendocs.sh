#!/bin/bash
#
# Copyright 2015 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Script to update generated documentation for SPF.
#
# Used to modify derived docs (like the API) and update version numbers.
#
# Author: nicksay@google.com (Alex Nicksay)


# Make sure node is properly installed.
node=$(command -v node)
npm=$(command -v npm)
if [[ $node == "" || $npm == "" ]]; then
  echo "Both node and npm must be installed to release."
  exit 1
fi
npm_semver=$(npm list --parseable semver)
if [[ $npm_semver == "" ]]; then
  echo 'The "semver" package is needed.  Run "npm install" and try again.'
  exit 1
fi
npm_jsdox=$(npm list --parseable jsdox)
if [[ $npm_jsdox == "" ]]; then
  echo 'The "jsdox" package is needed.  Run "npm install" and try again.'
  exit 1
fi


# Get the current verison.
version=$(bin/name.js --version)
release=$(bin/name.js)
echo "Updating documentation for version $version"


# Validate the tag.
object=$(git cat-file -t "v$version" 2> /dev/null)
if [[ $object == "tag" ]]; then
  tag="v$version"
elif [[ $1 == "--head" ]]; then
  tag="HEAD"
else
  echo "A valid git tag wasn't found for v$version."
  echo "Pass the --head flag to update from the latest commit instead."
  exit 1
fi


# From here on out, exit immediately on any error.
set -o errexit


# Update the API doc.
echo "Updating doc/api.md"
tmpdir=$(mktemp -d 2>/dev/null || mktemp -d -t 'spfjs-gendocs')
tmpfile="$tmpdir/api.js"
script=$(cat <<END_SCRIPT
import sys
for line in sys.stdin:
  sys.stdout.write(line)
  if '@fileoverview' in line:
    sys.stdout.write(' * @version $release\n')
END_SCRIPT
)
git cat-file -p "$tag:src/api.js" | python -c "$script" > $tmpfile
./node_modules/jsdox/bin/jsdox $tmpfile \
    --templateDir web/api \
    --index web/includes/apitoc --index-sort none \
    --output doc/

echo "Done"


# Update the Download doc.
echo "Updating doc/download.md"
pattern='\d+\.\d+\.\d+'
script=$(cat <<END_SCRIPT
import sys, re
for line in sys.stdin:
  sys.stdout.write(re.sub('$pattern', '$version', line))
END_SCRIPT
)
content=$(cat doc/download.md)
echo "$content" | python -c "$script" > doc/download.md


# Update the website.
echo "Updating web/config.yml"
script=$(cat <<END_SCRIPT
import sys
for line in sys.stdin:
  if line.startswith('release:'):
    sys.stdout.write('release: $release\n')
  elif line.startswith('version:'):
    sys.stdout.write('version: $version\n')
  else:
    sys.stdout.write(line)
END_SCRIPT
)
content=$(cat web/config.yml)
echo "$content" | python -c "$script" > web/config.yml
