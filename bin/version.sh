#!/bin/bash
#
# Copyright 2016 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Script to udpate the version of SPF and generate docs.
#
# Author: nicksay@google.com (Alex Nicksay)

# The script must be passed a version.
if [[ $# < 1 ]]; then
  echo "Usage: $(basename $0) [<newversion> | major | minor | patch ]"
  exit 1
fi

# Change to the root directory.
cd "$(dirname $(dirname "$0"))"

# Make sure node is properly installed.
node=$(command -v node)
npm=$(command -v npm)
if [[ $node == "" || $npm == "" ]]; then
  echo "Both node and npm must be installed to update versions."
  exit 1
fi
npm_semver=$(npm list --parseable semver)
if [[ $npm_semver == "" ]]; then
  echo 'The "semver" package is needed.  Run "npm install" and try again.'
  exit 1
fi

# Validate the version.
current=$(bin/name.js --version)
if [[ $1 == "major" || $1 == "minor" || $1 == "patch" ]]; then
  version=$(`npm bin`/semver -i $1 $current)
else
  version=$(`npm bin`/semver $1)
fi
if [[ $version == "" ]]; then
  echo "A valid version is needed."
  exit 1
fi

# Validate there are no pending changes.
if [[ -n $(git status --porcelain) ]]; then
  echo "Please commit or revert current changes before proceeding."
  exit 1
fi

# From here on out, exit immediately on any error.
set -o errexit

# Save the current branch.
branch=$(git symbolic-ref --short HEAD)

# Create a version branch, just in case.
git checkout -b version-$version

# Update package.json
echo "Updating package.json"
npm --no-git-tag-version version $version
echo "Updating src/license.js"
cp src/license.js src/license.js.tmp
cat src/license.js.tmp | sed "s/$current/$version/g" > src/license.js
rm src/license.js.tmp
echo "Commiting package.json and src/license.js changes..."
git commit -a -m "Mark v$version for release"

# Update documentatation
bin/gendocs.sh --head
echo "Commiting documentation changes..."
git commit -a -m "Update documentatation for v$version"

echo
echo "Version has been updated to v$version"
echo "Please send a pull request with this change."
