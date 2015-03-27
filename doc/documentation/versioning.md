---
title: Versioning
description: Automatically update script and style versions.
---


When using dynamic navigation, SPF transforms your site from
short-lived pages into a long-lived application.  When building
a long-lived application, an important concern is how to push
new code -- you don't want old JS attempting to interact with new
HTML or new CSS applying to old HTML.  SPF can automatically
update your script and style versions to ensure they stay in
sync with your content.

> **Note:** Automatic versioning only applies to
> [managed resources][].

As an example, consider a user currently on your site who
started with yesterday's code.  If you push updated scripts and
content, the user will transition to the new content and needs
the updated scripts as well.


## Use unique URLs for each version

You can can instruct SPF to
[manage a resource][managed resources] by giving it a `name`
attribute:

```html
<!-- external script -->
<script name="common" src="common-library.js"></script>
<!-- inline script -->
<script name="page">/* Page-specific script. */</script>
<!-- external style -->
<link name="common" rel="stylesheet" href="common-styles.css">
<!-- inline style -->
<style name="page">/* Page-specific style. */</style>
```

When navigating between pages, a named resource will only be
loaded once.  To detect updates, SPF tracks the external URL or
inline text associated with each resource name.  If when
processing response a changed URL or text is discovered, SPF
will unload the existing resource and load the new one.

To guarantee SPF switches between the old and new versions of
your scripts and styles, use a unique URL each time.  For
example, for the user currently on your site with yesterday's
code, they might have been served HTML like the following:

```html
<!-- old version -->
<script name="common" src="common-library-v1.js"></script>
```

Then, when you push updated scripts and content, update the URL
as well:

```html
<!-- new version -->
<script name="common" src="common-library-v2.js"></script>
```

> **Note:** SPF will automatically detect when the content of
> managed inline scripts and styles are updated by tracking a
> quick hash of the text content.  Whitespace is ignored when
> calculating the hash, so indentation and formatting changes
> will not trigger updates.


## Resource events

If you need to handle resources being unloaded when a new
version is detected, (e.g. to dispose event listeners, etc), SPF
will dispatch events before and after a resource is removed.
As with those detailed in the [Events][] documentation,
these events are defined in the [API][] as [spf.Event][]
objects.  The events and their descriptions follow:

**`spfcssbeforeunload`**  
Fired before unloading a managed style resource.  Occurs when
an updated style is discovered for a given name.

**`spfcssunload`**  
Fired when unloading a managed style resource.  If the style
is being unloaded as part of switching versions, unloading of
the old style occurs after the new style is loaded to avoid
flashes of unstyled content.

**`spfjssbeforeunload`**  
Fired before unloading a managed script resource.  Occurs when
an updated script is discovered for a given name.

**`spfjsunload`**  
Fired when unloading a managed script resource.  If the script
is being unloaded as part of switching versions, unloading of
the old script occurs after the new script is loaded for
consistency with style loading.



[managed resources]:  ./resources.md#managed-resources
[Events]: ./events.md
[API]: ../api.md
[spf.Event]: ../api.md#spf.event
