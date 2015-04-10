---
title: Resources
description: Manage script and style loading.
---


As briefly mentioned in the [Responses overview][responses],
when SPF processes a response, it will install JS and CSS from
the `head` fragment, any of the `body` fragments, and the `foot`
fragment.  However, SPF has two methods of handling scripts and
styles: unmanaged and managed.  Both are detailed below.


## Unmanaged Resources

SPF parses each fragment for scripts and styles, extracts them,
and executes them by appending them to the `<head>` of the
document.  For example, given the following response:

```json
{
  "head": "
    <style>.foo { color: blue }</style>
    <link href=\"file.css\" rel=\"stylesheet\">
  ",
  "body": {
    "element-id-a": "Lorem ipsum dolor sit amet",
    "element-id-b": "consectetur adipisicing elit"
  },
  "foot": "
    <script src=\"file.js\"></script>
    <script>alert('hello');</script>
  "
}
```

Then, when SPF processes this response, it will do the following
steps:

1.  Append `<style>.foo { color: blue }</style>` to the document
    `<head>` to eval the CSS.
2.  Append `<link href="file.css" rel="stylesheet">` to the
    document `<head>` to load the CSS file.
3.  Update the element with DOM id `element-id-a` with the HTML
    `Lorem ipsum dolor sit amet`.
4.  Update the element with DOM id `element-id-b` with the HTML
    `consectetur adipisicing elit`.
5.  Append `<script src="file.js"></script>` to the document
    `<head>` to load the JS file **and wait for it to complete
    before continuing**.
6.  Append `<script>alert('hello');</script>` to the document
    `<head>` to eval the JS.

> **Note:** SPF will wait for script loading or execution to
> complete before processing.  This matches browser behavior and
> ensures proper script execution order.  (See step 4 above.)
> To not wait for script execution, add the `async` attribute:
>
> ```html
> <script src="file.js" async></script>
> ```

As you navigate to and from the page sending this response,
these steps will be repeated each time.


## Managed Resources

However, a significant benefit of SPF is that only sections of
the page are updated with each navigation instead of the browser
performing a full reload.  That means — almost certainly — not
every script and style needs to be executed or loaded during
every navigation.

Consider the following common pattern where two scripts are
loaded per page: one containing common library code (e.g.
jQuery) and a second containing page-specific code.   For
example, a search page and an item page:

Search Page:

```html
<!-- common-library.js provides utility functions -->
<script src="common-library.js"></script>
<!-- search-page.js provides functions for the search page -->
<script src="search-page.js"></script>
```

Item Page:

```html
<!-- common-library.js provides utility functions -->
<script src="common-library.js"></script>
<!-- item-page.js provides functions for the item page -->
<script src="item-page.js"></script>
```

As a user navigates from the search page to the item page, the
`common-library.js` file does not need to be loaded again, as
it's already in the page.  You can instruct SPF to manage this
script by giving it a `name` attribute.  Then, when it
encounters the script again, it will not reload it:

```html
<script name="common" src="common-library.js"></script>
```

By applying this to all the scripts, a user can navigate back
and forth between the two pages and only ever load a given file
once:

Search Page:

```html
<script name="common" src="common-library.js"></script>
<script name="search" src="search-page.js"></script>
```

Item Page:

```html
<script name="common" src="common-library.js"></script>
<script name="item" src="item-page.js"></script>
```

Now, given the following navigation flow:

    [ search ]--->[ item ]--->[ search ]--->[ item ]

Then, when SPF processes the responses for each page in that
flow, it will do the following steps:

1.  **Navigate to the search page.**
2.  Load the `common-library.js` JS file and wait for it to
    complete before continuing.
3.  Load the `search-page.js` JS file and wait for it to
    complete before continuing.
4.  **Navigate to the item page.**
5.  _Skip reloading `common-library.js`._
6.  Load the `item-page.js` JS file and wait for it to complete
    before continuing.
7.  **Navigate to the search page.**
8.  _Skip reloading `common-library.js`._
9.  _Skip reloading `search-page.js`._
10. **Navigate to the item page.**
11. _Skip reloading `common-library.js`._
12. _Skip reloading `item-page.js`._

Navigation between the two pages now avoids unnecessarily
reloading the scripts.

> **Note:** See the [Events][events] documentation to properly
> handle initialization and disposal of pages during navigation
> to avoid memory leaks and outdated event listeners.

> **Note:** See the [Versioning][versioning] documentation to
> automatically switch between script and style versions for seamless
> releases.



[responses]: ./responses.md
[events]: ./events.md
[versioning]: ./versioning.md
