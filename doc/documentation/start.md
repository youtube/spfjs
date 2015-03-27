---
title: Get Started
description:
    "Use SPF on your site: send requests, return responses."
---


## Get the code

Before getting started, first **[download the code][]**.


## _Optional:_ Run the demo

If you cloned the project from GitHub or downloaded the source
code, you can run the included demo application to see how
everything works together in order to test out the framework:

```sh
cd spfjs
npm install
npm start
```

You can then open <http://localhost:8080/> in your browser and
check out the demo.

> **Note:** You will need `npm` to install the development
> dependencies and `python` to run the demo application.  You
> can check if they are installed by running the following:
>
> ```sh
> npm --version
> python --version
> ```
>
> If you need to install `npm`, go to <https://nodejs.org/> and
> click "Install" to get the installer.  If you need to install
> `python`, go to <https://www.python.org/> and go to
> "Downloads" to get the installer.


## Enable SPF

To add SPF to your site, you need to include the JS file and run
`spf.init()` to enable the new functionality.

After [downloading][] the code, copy the `spf.js` file to where
you serve JS files for your site, add the script to your page,
and initialize SPF:

```html
<script src="PATH-TO-YOUR-JS/spf.js"></script>
<script>
  spf.init();
</script>
```


## Send requests

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


## Return responses

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



[download the code]: ../download.md
[downloading]: ../download.md
