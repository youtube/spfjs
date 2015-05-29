---
title: Caching
description:
    Custom response caching for greater application flexibility.
---


When building a complex web application, sometimes you want more
flexibility than standard HTTP based caching in order to best
balance your application logic with performance.  SPF provides
a local configurable response cache that you can adjust as
needed.


## When the cache is used

Before making a request, SPF checks the local cache to see if a
valid cached response is available for the requested URL.  If
one is found, then it will be used instead of sending a request
over the network.  If not, after the response is received, SPF
will place that response in the local cache for future use.

By default, SPF uses a caching model that matches the
back-forward cache in browsers: "new" navigation will not use a
previously cached response, whereas "history" navigation will.
This means that your server will receive requests for every link
click, for example, but not for back button uses.  However, if
the `cache-unified` config value is set to `true`, then SPF will
use an available cache response for all navigations.  This will
mean that your server will not receive requests for link clicks
that are to previously visited pages, just like for back button
presses.

When [prefetching][] responses, by default, SPF will place a
prefetched response in the local cache as eligible for one "new"
navigation.  After that one use, the cached response will only
be eligible for "history" navigation.  However, if the
`cache-unified` config value is set to `true`, then the
prefetched response will be available for all navigations like
other cached responses.


## Configuring the cache

You may configure the cache using parameters to control the
total number and lifetime of entries in the cache.  Increasing
these settings will increase the chance of finding a valid,
cached response and also consume more memory in the browser.
Conversely, decreasing these settings will decrease the chance
of finding a valid cached response and also consume less memory
in the browser.  A list of the configuration parameters and
their descriptions follows:

**`cache-lifetime`**  
The maximum time in milliseconds a cache entry is considered
valid.  Defaults to `600000` (10 minutes).

**`cache-max`**  
The maximum number of total cache entries.  Defaults to `50`.

**`cache-unified`**  
Whether to unify all cache responses instead of separating them
by use (e.g. history, prefetching). Defaults to `false`.


## Automatic garbage collection

The cache performs automatic garbage collection by removing
entries at two times:

1. If a requested entry is found but it is expired according to
the configured lifetime, the entry is removed from the cache
instead of being used.

2. Each time a new entry is added, the
cache does asynchronous garbage collection.  This garbage
collection first removes all expired entries, then if needed, it
removes entries in the cache that exceed the configured maximum
size with a least-recently-used (LRU) policy.


## Manually adjusting the cache

Sometimes you might need to manually remove an entry from the
cache.  For example, a user might take an action on the page
that changes it, and you would like future requests to reflect
that action; by making the next request the server, the response
will stay in sync.

Each [spfdone][] event specifies a `cacheKey` attribute in the
[response object][].  You can use this `cacheKey` to reference a
specific cache entry when calling API functions that manipulate
the cache.  A list of API functions and their descriptions
follow:

**`spf.cache.remove(key)`**  
Removes an entry from the cache.  Pass a `cacheKey` from a
response object to reference the entry you wish to remove.  See
also the API reference for [spf.cache.remove][].

**`spf.cache.clear()`**  
Removes all entries from the cache.  See also the API reference
for [spf.cache.clear][].



[prefetching]: ./prefetching.md
[spfdone]: ../events.md#event-descriptions
[response object]: ../../api.md#spf.singleresponse
[spf.cache.remove]: ../../api.md#spf.cache.remove
[spf.cache.clear]: ../../api.md#spf.cache.clear
