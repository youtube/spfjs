---
title: Response Processing
description: An overview of SPF responses and how they are processed.
---

In dynamic navigation, SPF updates the page with content from the response.
SPF will do this processing in the following order:

1. `title` — Update document title
2. `url` — Update document url
3. `head` — Install early page-wide styles
4. `attr` — Set element attributes
5. `body` — Set element content and install element-level scripts
            (styles handled by browser)
6. `foot` — Install late page-wide scripts

> **Note:** All fields are optional and the commonly needed response values are
> `title`, `head`, `body`, and `foot`.


A response is typically in the following format:

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
