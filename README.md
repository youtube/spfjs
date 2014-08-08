# SPF  [![Build Status](https://secure.travis-ci.org/youtube/spfjs.png?branch=master)](http://travis-ci.org/youtube/spfjs)

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

Running `make` will download needed packages.  You will need Python and Java
installed to build and compile.

Then, add the script to your page and initialize SPF:

```html
<script src="spf.js"></script>
<script>
  spf.init();
</script>
```

You can build the included demo application to see examples of both
client-side and server-side implementation and test out the framework:

```shell
$ make demo
```

Then, open `http://0.0.0.0:8080/` in your browser.


## Client-Side Implementation

SPF does not change your site's navigation automatically and instead uses
progressive enhancement to enable dynamic navigation for certain links.  Just
add a `spf-link` class to `<a>` tags or their containers to activate SPF:

Static Navigation:

```html
<a href="/destination">Go!</a>

<ul>
  <li><a href="/option/one">Menu item 1</a></li>
  <li><a href="/option/two">Menu item 2</a></li>
</ul>
```


Dynamic Navigation:

```html
<a class="spf-link" href="/destination">Go!</a>

<ul class="spf-link">
  <li><a href="/option/one">Menu item 1</a></li>
  <li><a href="/option/two">Menu item 2</a></li>
</ul>
```

When an enabled link is clicked, SPF will handle the history and request the
fragments for the destination link.


## Server-Side Implementation

In static navigation, an entire HTML page is sent.  In dynamic navigation, only
fragments are sent, using JSON as transport.  When SPF sends a request to the
server, it appends an identifier `?spf=navigate` so that you can properly
handle the request.

In the following example, a common layout of upper masthead, middle content, and
lower footer is used.  In dynamic navigation, only the fragment for the middle
content is sent, since the masthead and footer don't change.

Static Navigation:  `GET /destination`

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

Dynamic Navigation:  `GET /destination?spf=navigate`

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


## Response Processing

SPF responses are processed in the following order (all fields are optional):

1. `title` — Update document title
2. `url` — Update document url
3. `head` — Install early page-wide styles
4. `attr` — Set element attributes
5. `body` — Set element content and install element-level scripts
            (styles handled by browser)
6. `foot` — Install late page-wide scripts

The commonly needed response values are `title`, `head`, `body`, and `foot`,
in the following general format:

```json
{
    "title": "Document Title",
    "head":  "<style>CSS Text</style>
             <link rel=\"stylesheet\" type=\"text/css\" href=\"CSS URL\">
             ...",
    "body":  {  "DOM ID 1": "HTML Text...",
                "DOM ID 2": "..."
             },
    "foot":  "<script>JS Text</script>
             <script src=\"JS URL\"></script>
             ..."
}
```

This pattern follows the general good practice of "styles in the head, scripts
at the end of the body".  The "foot" field represents the "end of the body"
section without requiring developers to create an explicit element.

To update specific element attributes, the response format is as follows:

```json
{
      "attr":  {  "DOM ID 1":  {  "Name 1": "Value 1",
                                  "Name 2": "Value 2"
                               },
                  "DOM ID 2":  {  "...": "..."  }
               }
}
```


## Get Help

**We're actively working on our documentation!**  More information, examples,
and a website is coming soon.  Don't hesitate to reach out to us via our
[mailing list](https://groups.google.com/forum/#!forum/spfjs) and follow
[@spfjs](https://twitter.com/spfjs) on Twitter for updates.


## License

MIT  
Copyright 2012-2014 Google, Inc.
