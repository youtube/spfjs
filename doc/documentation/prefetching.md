---
title: Prefetching
description: Prefetch responses before they're requested.
---

SPF is designed to enable fast navigation, and the best way to
speed up a navigation request is to not make it all.
Prefetching allows you to fetch responses before they are
requested and store them in the [local cache][] until they are
needed.  You can also prefetch [scripts and styles][resources]
to prime the browser cache.


## Prefetching requests

Prefetching a response is done by calling the [spf.prefetch][]
function, which behaves nearly identically to [spf.navigate][]
and accepts the same [callbacks and cancellations][] when passed
an object that conforms to the [spf.RequestOptions][] interface.
A list of callbacks follows:

| Callback    | State                         | Cancel |
|:------------|:------------------------------|:-------|
| `onRequest` | Started; Sending Prefetch     | Abort  |
| `onProcess` | Processing; Response Received | Abort  |
| `onDone`    | Done                          |        |

When SPF sends the prefetch request to the server, it will
append the configurable identifier to the URL in the same manner
as navigation; by default, this value will be `?spf=prefetch`.

When the prefetched response has been received, SPF will place
it in the local cache as eligible for one "new" navigation.
After that one use, the cached response will only be eligible
for "history" navigation.  However, if the `cache-unified`
config value is set to `true`, then the prefetched response will
be available for all navigations like other cached responses.
For more information, see [when the cache is used][].


## Prefetching resources

When SPF processes a prefetched response, it will prefetch any
[resources][] to ensure the browser cache is primed.  Fetching
JS and CSS files before they are needed makes future navigation
faster.

To manually prefetch resources, the following API functions can
be used:

**`spf.script.prefetch(urls)`**  
Prefetches one or more scripts; the scripts will be requested
but not loaded.  See also the API reference for
[spf.script.prefetch][].

**`spf.style.prefetch(urls)`**  
Prefetches one or more stylesheets; the stylesheets will be
requested but not loaded.  See also the API reference for
[spf.style.prefetch][].



[local cache]: ./caching.md
[resources]: ./resources.md
[spf.prefetch]: ../api.md#spf.prefetch
[spf.navigate]: ../api.md#spf.navigate
[callbacks and cancellations]: ./events.md#callbacks-and—cancellations
[spf.RequestOptions]: ../api.md#spf.requestoptions
[when the cache is used]: ./caching.md#when-the-cache-is-used
[spf.script.prefetch]: ../api.md#spf.script.prefetch
[spf.style.prefetch]: ../api.md#spf.style.prefetch
