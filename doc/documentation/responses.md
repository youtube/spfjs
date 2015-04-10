---
title: Responses
description:
    An overview of SPF responses and how they are processed.
---


In dynamic navigation, SPF updates the page with content from
the response. SPF will do this processing in the following
order:

1. `title` — Update document title
2. `url` — Update document URL
3. `head` — Install early JS and CSS
4. `attr` — Set element attributes
5. `body` — Set element content and install JS and CSS
6. `foot` — Install late JS and CSS

> **Note:** All fields are optional and the commonly needed
> response values are `title`, `head`, `body`, and `foot`.


A response is typically in the following format:

```json
{
  "title": "Page Title",
  "head":
      "<style>CSS Text</style>
       <!-- and/or -->
       <link href=\"CSS URL\" rel=\"stylesheet\">
       ...",
  "body": {
    "DOM ID 1": "HTML Text...",
    "DOM ID 2": "..."
  },
  "foot":
      "<script>JS Text</script>
       <!-- and/or -->
       <script src=\"JS URL\"></script>
       ..."
}
```

This pattern follows the general good practice of "styles in the
head, scripts at the end of the body".  The "foot" field
represents the "end of the body" section without requiring
developers to create an explicit element.

To update specific element attributes, the response format is as
follows:

```json
{
  "attr": {
    "DOM ID 1": {
      "Name 1": "Value 1",
      "Name 2": "Value 2"
    },
    "DOM ID 2":  {
      "...": "..."
    }
  }
}
```
