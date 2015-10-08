# Releasing

When an update to SPF needs to be released, follow these steps.
You will need admin privileges for the GitHub [youtube/spfjs][]
repo.


## Prepare the new version

1.  Ensure all code has been tested. Verify changes from the
    previous version manually and make sure all unit tests pass.

2.  Increment the `version` property in the `package.json` and
    `bower.json` files using [semantic versioning][].

3.  Commit the change, titling it "Mark vX.Y.Z for release"
    (where "X.Y.Z" is the new version number, e.g. "v2.2.0").

4.  Send a pull request with the change.


## Release the new version

1.  Merge the pull request.

2.  In a clone of the repo (not of a fork), run `git log` to
    locate the hash of the commit.

3.  Run `bin/release.sh commit-hash`, replacing "commit-hash"
    with the hash of the commit. This:

    - builds the release files and commits them to an isolated
      branch under the `dist/` folder
    - tags the commit as "vX.Y.Z"
    - pushes the tag to the GitHub repo, allowing the built
      release output to be accessible via the tagged commit but
      not the master branch


## Distribute the new version

1.  Run `bin/distribute.sh vX.Y.Z`. This:

    - creates a distribution ZIP archive of the built release
      files at `build/spfjs-X.Y.Z-dist.zip`
    - pushes the updated source and release files for the npm
      package

2.  If you have ownership of the npm [spfjs][] package, the
    `bin/distribute.sh` script will automatically push the
    update.  If not, request a push by emailing one of the
    owners listed by running `npm owner ls` and emailing with
    the subject "npm Update Request: SPF vX.Y.Z".

3.  Request an update to the [Google Hosted Libraries][] CDN.
    Email <nicksay@google.com> with the subject
    "Hosted Libraries CDN Update Request: SPF vX.Y.Z".


## Document the new version

1.  Go to the [GitHub Tags][] page and click "Add release notes"
    next to the new version.

2.  Title the release "SPF XY (X.Y.Z)". You can run
    `bin/name.js` to generate a title to copy/paste.

3.  Write the release notes, highlighting new features or
    fixed bugs. Auto-link to issues using the `#NUM` syntax.

4.  Attach the distribution ZIP archive `spfjs-X.Y.Z-dist.zip`.

5.  Publish the release.

6.  Run `bin/gendocs.sh`.  This:

    - updates the `release` and `version` properties in the
      `web/_config.yml` file to match the output of
      `bin/name.js` and `bin/name.js --version` respectively.
    - updates the `doc/api.md` and `doc/download.md`, the
      sources for the [API][] and [Download][] pages.

7.  Commit the change, titling it
    "Update documentation for vX.Y.Z".

8.  Send a pull request with the change.

9.  Merge the pull request.

10. Push the website.


## Announce the new version

1.  Post from the [@spfjs][] Twitter account announcing the
    new version and linking to the GitHub release page and the
    [Download][] page.

2.  Send an email to <spfjs@googlegroups.com> announcing the
    new version, summarizing the release notes, and linking to
    the GitHub release page and the [Download][] page.



[semantic versioning]: http://semver.org/
[youtube/spfjs]: https://github.com/youtube/spfjs
[spfjs]: https://www.npmjs.com/package/spf
[Google Hosted Libraries]: https://developers.google.com/speed/libraries/devguide#spf
[GitHub Tags]: https://github.com/youtube/spfjs/tags
[API]: https://youtube.github.io/spfjs/api/
[Download]: https://youtube.github.io/spfjs/download/
[@spfjs]: https://twitter.com/spfjs
