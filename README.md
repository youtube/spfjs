# [![SPF][]](https://youtube.github.io/spfjs/)

[![Version][]](https://badge.fury.io/js/spf)
[![Status][]](https://travis-ci.org/youtube/spfjs)
[![InlineDocs][]](https://inch-ci.org/github/youtube/spfjs)


Structured Page Fragments — or SPF for short — is a lightweight
JS framework for fast navigation and page updates from YouTube.

Using progressive enhancement and HTML5, SPF integrates with
your site to enable a faster, more fluid user experience by
updating just the sections of the page that change during
navigation, not the whole page.  SPF provides a response format
for sending document fragments, a robust system for script and
style management, an in-memory cache, on-the-fly processing, and
more.

**Learn more at [youtube.github.io/spfjs][]**


## Overview

SPF allows you to leverage the benefits of a static initial page
load, while gaining the performance and user experience benefits
of dynamic page loads:

**User Experience**  
1. Get the fastest possible initial page load.  
2. Keep a responsive persistent interface during navigation.  

**Performance**  
1. Leverage existing techniques for static rendering.  
2. Load small responses and fewer resources each navigation.  

**Development**  
1. Use any server-side language and template system.  
2. Be productive by using the same code for static and dynamic
   rendering.


## Download

Install with [npm][]:

```sh
npm install spf
```

Install with [Bower][]:

```sh
bower install spf
```

Or, see the [download page][] for options to download the latest
release and link to minified JS from a CDN:

> [Download SPF](https://youtube.github.io/spfjs/download/)


## Get Started

The SPF client library is a single ~10K [UMD][] JS file with no
dependencies.  It may be asynchronously delay-loaded.  All
functions are exposed via the global `spf` object.

**Enable SPF**

To add SPF to your site, include the JS file and run `spf.init()`.

```html
<script>
  spf.init();
</script>
```

**Send requests**

SPF does not change your site's navigation automatically and
instead uses progressive enhancement to enable dynamic
navigation for certain links.  Just add a `spf-link` class to an
`<a>` tag to activate SPF.

Go from static navigation:

```html
<a href="/destination">Go!</a>
```

to dynamic navigation:

```html
<!-- Link enabled: a SPF request will be sent -->
<a class="spf-link" href="/destination">Go!</a>
```

**Return responses**

In static navigation, an entire HTML page is sent.  In dynamic
navigation, only fragments are sent, using JSON as transport.
When SPF sends a request to the server, it appends a
configurable identifier to the URL so that your server can
properly handle the request.  (By default, this will be
`?spf=navigate`.)

In the following example, a common layout of upper masthead,
middle content, and lower footer is used.  In dynamic
navigation, only the fragment for the middle content is sent,
since the masthead and footer don't change.

Go from static navigation:

`GET /destination`

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

to dynamic navigation:

`GET /destination?spf=navigate`

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

See the [documentation][] for complete information.


## Browser Support

To use dynamic navigation, SPF requires the HTML5 History API.
This is broadly supported by all current browsers, including
Chrome 5+, Firefox 4+, and IE 10+.  See a full browser
compatibility table at [Can I Use][].  Underlying functionality,
such as AJAX-style page updates and script/style loading, is
more broadly supported by IE 8+.


## Get Help

Send feedback, comments, or questions about SPF to
<spfjs@googlegroups.com>.

File bugs or feature requests at [GitHub][].

Join our [mailing list][] and follow [@spfjs][] on Twitter for
updates.


## License

MIT  
Copyright 2012-2017 Google, Inc.



[youtube.github.io/spfjs]: https://youtube.github.io/spfjs/
[npm]: https://www.npmjs.com/
[Bower]: http://bower.io/
[download page]: https://youtube.github.io/spfjs/download/
[UMD]: https://github.com/umdjs/umd
[documentation]: https://youtube.github.io/spfjs/documentation/
[Can I Use]: http://caniuse.com/#feat=history
[GitHub]: https://github.com/youtube/spfjs/issues
[mailing list]: https://groups.google.com/group/spfjs
[@spfjs]: https://twitter.com/spfjs

[SPF]: https://youtube.github.io/spfjs/assets/images/banner-728x388.jpg
[Version]: https://badge.fury.io/js/spf.svg
[Status]: https://secure.travis-ci.org/youtube/spfjs.svg?branch=master
[InlineDocs]: https://inch-ci.org/github/youtube/spfjs.svg?branch=master
