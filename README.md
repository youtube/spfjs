# SPF

Structured Page Fragments — or SPF for short — is a lightweight framework that
handles navigation and updates of page sections. Using progressive
enhancement and HTML5, SPF seamlessly updates pages with server-side rendering.
Only document fragments are sent, and corresponding page sections are
asynchronously updated when received.


## Overview

When someone first arrives at a site, content is sent from the server and
rendered normally.  This is _static_ navigation.  But when going to the next
page, only document fragments are sent, and sections are updated accordingly.
We call this _dynamic_ navigation.  The basic navigation flow is:

1. Client handles click; adds history.
2. Client requests fragments.
3. Server responds with fragments.
4. Client updates page.


## Benefits

SPF allows you to leverage the benefits of an initial page load using static
navigation, while gaining the performance and user experience benefits of
dynamic rendering for subsequent pages.

User Experience:

* Fastest possible first page rendering
* Persistent interface stays responsive during navigation

Performance:

* Leverage existing web performance techniques for static rendering
* Subsequent responses are smaller
* Scripts and styles are already loaded for the next navigation

Development:

* Maintain productivity using the same code for static and dynamic rendering
* Use any server-side language and any template system
* Send data for use with a client-side system


## Features

SPF has additional, optional features you can use to improve your site.

**Caching:** In some web apps, HTTP caching isn't appropriate.  SPF allows you
to cache responses in client memory according to your application-specific
parameters.

**Prefetching:** Make requests early, automatically or manually, to predictively
boost performance with instant access to future pages.

**Multipart:** SPF supports streaming multipart responses in chunks to enable
on-the-fly processing.  This speeds up navigation by starting rendering early.


## Get Started

SPF has no dependencies and is a single standalone file.  It is only ~9K when
minified and gzipped, and it may be asynchronously delay-loaded.

To get started, clone the project, build the main SPF file, and copy it where
you serve JS files for your site:

```shell
$ git clone https://github.com/youtube/spfjs.git
$ cd spfjs
$ make
$ cp build/spf.js YOUR_JS_DIR/
```

Add the script to your page, initialize SPF:

```html
<script src="spf.js"></script>
<script>
  spf.init();
</script>
```

Then, when a SPF request is received, return only the fragments that change,
using JSON as a transport.  In the following example, a common layout of upper
masthead, middle content, and lower footer is used.  In static navigation, the
entire response is sent, but in dynamic navigation, only the fragment for the
middle content is sent, since the masthead and footer don't change.

Static Navigation:

```html
<html>
 <head>
  <!-- Styles -->
 </head>
 <body>
  <div id="masthead">...</div>
  <div id="content">
    <!-- Content -->
  </div>
  <div id="footer">...</div>
  <!-- Scripts -->
 </body>
</html>
```

Dynamic Navigation:

```json
{
 "head": "<!-- Styles -->",
 "body": {
  "content":
    "<!-- Content -->",
 },
 "foot": "<!-- Scripts -->"
}
```

## Get Help

**We're actively working on our documentation!**  More information, examples,
and a website is coming soon.  Don't hesitate to reach out to us via our
[mailing list](https://groups.google.com/forum/#!forum/spfjs) and follow
[@spfjs](https://twitter.com/spfjs) on Twitter for updates.

## License

Unless otherwise noted, all code is distributed under The MIT License.  See the
[LICENSE](https://github.com/youtube/spfjs/blob/master/LICENSE) file for
details.
