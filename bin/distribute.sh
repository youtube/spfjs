#!/bin/bash
#
# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Script to distribute a released version of SPF.
#
# Author: nicksay@google.com (Alex Nicksay)

# The script must be passed a git release tag to distribute.
if [[ $# < 1 ]]; then
  echo "Usage: $(basename $0) tag_to_release"
  exit 1
fi

# Make sure node is properly installed.
node=$(command -v node)
npm=$(command -v npm)
if [[ $node == "" || $npm == "" ]]; then
  echo "Both node and npm must be installed to distribute."
  exit 1
fi

# Validate the release tag.
tag=$(git describe $1)
if [[ $tag == "" ]]; then
  echo "A valid tag is needed for distribution."
  exit 1
fi

# From here on out, exit immediately on any error.
set -o errexit

# Save the current branch.
branch=$(git symbolic-ref --short HEAD)

# Check out the tag.
git checkout -q $tag

# Validate the version.
version=$(bin/name.js --version)
if [[ $version == "" ]]; then
  echo "A valid version is needed for distribution."
  git checkout -q $branch
  exit 1
fi
if [[ $tag != "v$version" ]]; then
  echo "The release tag must match the distribution version."
  git checkout -q $branch
  exit 1
fi

# Confirm the tag.
while true; do
  read -p "Distribute $tag? [y/n] " answer
  case $answer in
    [Yy]* )
      break;;
    [Nn]* )
      git checkout -q $branch;
      exit;;
  esac
done

# Create a temp branch, just in case.
git checkout -b distribute-$tag

# Build a distribution archive for upload to GitHub and CDNs.
echo "Building distribution archive..."
mkdir -p build/spfjs-$version-dist/
cp dist/* build/spfjs-$version-dist/
cd build
zip spfjs-$version-dist.zip spfjs-$version-dist/*
cd ..
echo "The archive contents are:"
unzip -l build/spfjs-$version-dist.zip
echo "The distribution archive has been created at:"
echo "    build/spfjs-$version-dist.zip"

# Confirm publishing.
while true; do
  echo
  echo "WARNING: You cannot undo this next step!"
  echo "Once $tag is published to npm, it cannot be changed."
  echo
  read -p "Publish $tag to npm? [y/n] " answer
  case $answer in
    [Yy]* )
      break;;
    [Nn]* )
      git checkout -q $branch;
      exit;;
  esac
done

# Publish to npm.
npm_user=$(npm whoami 2> /dev/null)
npm_publish="false"
if [[ $npm_user == "" ]]; then
  echo 'Skipping "npm publish" because npm credentials were not found.'
  echo "To get credentials on this machine, run the following:"
  echo "    npm login"
else
  npm_owner=$(npm owner ls | grep "$npm_user")
  if [[ $npm_owner == "" ]]; then
    echo 'Skipping "npm publish" because npm ownership was not found.'
    echo "The current list of npm owners is:"
    npm owner ls | sed 's/^/    /'
    echo "To get ownership, have an existing owner run the following:"
    echo "    npm owner add $npm_user"
  else
    npm_publish="true"
  fi
fi
if [[ $npm_publish == "false" ]]; then
  echo "To publish this release to npm later, run the following:"
  echo "    git checkout v$version"
  echo "    npm publish"
else
  npm publish
  echo "Published to npm."
fi

# Return to the original branch.
git checkout $branch
git branch -D distribute-$tag
echo "Distributed $tag."
