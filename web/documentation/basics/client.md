---
title: Client Integration
description: Make the changes needed to send SPF requests.
---

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
