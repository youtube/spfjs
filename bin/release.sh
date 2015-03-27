#!/bin/bash
#
# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

# Script to tag and release a version of SPF.
#
# Author: nicksay@google.com (Alex Nicksay)


# The script must be passed a git commit to use as the release.
if [[ $# < 1 ]]; then
  echo "Usage: $(basename $0) sha_of_commit_to_release"
  exit 1
fi

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

# Validate the commit.
commit=$(git rev-parse --quiet --verify $1)
if [[ $commit == "" ]]; then
  echo "A valid commit is needed for the release."
  exit 1
fi

# From here on out, exit immediately on any error.
set -o errexit

# Save the current branch.
branch=$(git symbolic-ref --short HEAD)

# Check out the commit.
git checkout -q $commit

# Validate the version.
version=$(bin/name.js --version)
if [[ $version == "" ]]; then
  echo "A valid version is needed for the release."
  git checkout -q $branch
  exit 1
fi

# Confirm the release.
while true; do
  read -p "Release commit $commit as v$version? [y/n] " answer
  case $answer in
    [Yy]* )
      break;;
    [Nn]* )
      git checkout -q $branch;
      exit;;
  esac
done

# Create a temp branch, just in case.
git checkout -b release-$commit-$version

# Build the release files.
echo "Building release files..."
npm run dist

# Add the files to be released.
git add -f dist/*

# Sanity check the files in case anything unintended shows up.
git status
while true; do
  read -p "Do the files to commit look correct? [y/n] " answer
  case $answer in
    [Yy]* )
      break;;
    [Nn]* )
      git reset HEAD dist/*
      git checkout $branch
      git branch -D release-$commit-$version
      exit;;
  esac
done

tag="v$version"

# Commit the release files.
git commit -m "$tag"

# Tag the commit as the release.
git tag -a "$tag" -m "$tag"

# Confirm release.
while true; do
  echo
  echo "WARNING: You should not undo this next step!"
  echo "Once $tag is pushed, it should not be changed."
  echo
  read -p "Push $tag to github? [y/n] " answer
  case $answer in
    [Yy]* )
      break;;
    [Nn]* )
      git checkout -q $branch;
      exit;;
  esac
done

# Push the tag.
git push --tags

# Return to the original branch.
git checkout $branch
git branch -D release-$commit-$version
echo "Released $tag."
