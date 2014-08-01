---
title: Server Integration
description: Make the changes needed to return SPF responses.
---

In static navigation, an entire HTML page is sent.  In dynamic navigation, only
fragments are sent, using JSON as transport.  When SPF sends a request to the
server, it appends a configurable identifier to the URL so that you can properly
handle the request.  (By default, this will be `?spf=navigate`.)

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
