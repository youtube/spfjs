---
title: API
description: The JS API reference.
layout: api
---


The following API reference is for **SPF 24 (v2.4.0)**.


* * *

## spf

The top-level SPF namespace.

### spf.init

**Function**  
`spf.init(opt_config)`  
Initializes SPF.

**Parameters**  
`opt_config: Object`  
Optional global configuration object.  

**Returns**  
`boolean`  
Whether SPF was successfully initialized.  If the HTML5
    history modification API is not supported, returns false.  


### spf.dispose

**Function**  
`spf.dispose()`  
Disposes SPF.


### spf.navigate

**Function**  
`spf.navigate(url, opt_options)`  
Navigates to a URL.

A pushState history entry is added for the URL, and if successful, the
navigation is performed.  If not, the browser is redirected to the URL.
During the navigation, first the content is requested.  If the reponse is
sucessfully parsed, it is processed.  If not, the browser is redirected to
the URL.  Only a single navigation request can be in flight at once.  If a
second URL is navigated to while a first is still pending, the first will be
cancelled.

**Parameters**  
`url: string`  
The URL to navigate to, without the SPF identifier.  
`opt_options: Object | spf.RequestOptions`  
Optional request options.  


### spf.load

**Function**  
`spf.load(url, opt_options)`  
Loads a URL.

Similar to [spf.navigate](#spf.navigate), but intended for traditional content
updates, not page navigation.  Not subject to restrictions on the number of
simultaneous requests.

**Parameters**  
`url: string`  
The URL to load, without the SPF identifier.  
`opt_options: Object | spf.RequestOptions`  
Optional request options.  

**Returns**  
`XMLHttpRequest`  
The XHR of the current request.  


### spf.process

**Function**  
`spf.process(response, opt_callback)`  
Process a SPF response on the current page outside of a navigation flow.

**Parameters**  
`response: spf.SingleResponse | spf.MultipartResponse`  
The SPF response
    object to process.  
`opt_callback: function`  
Function to execute when processing is done; the argument is
    the `response`.  


### spf.prefetch

**Function**  
`spf.prefetch(url, opt_options)`  
Prefetches a URL.

Use to prime the SPF request cache with the content and the browser cache
with script and stylesheet URLs.  If the response is successfully parsed, it
is preprocessed to prefetch scripts and stylesheets as well.

**Parameters**  
`url: string`  
The URL to prefetch, without the SPF identifier.  
`opt_options: Object | spf.RequestOptions`  
Optional request options.  

**Returns**  
`XMLHttpRequest`  
The XHR of the current request.  


### spf.SingleResponse

**Class**  
Definition for a single SPF response object.

**Attributes**  
`attr: Object.<string, Object.<string, string>> | undefined`  
Map of Element IDs to maps of attibute names to values for the Elements.  
`body: Object.<string, string> | undefined`  
Map of Element IDs to HTML strings containing content of the Elements.  The
content may contain script and/or style tags to be executed or installed.  
`cacheKey: string | undefined`  
String of the cache key used to store this response.  
`cacheType: string | undefined`  
String of the type of caching to use for this response.  
`data: * | undefined`  
Reserved for client data of any type.  
`head: string | undefined`  
HTML string containing CSS and/or JS tags to execute or install.  
`foot: string | undefined`  
HTML string containing JS and/or CSS tags to execute or install.  
`redirect: string | undefined`  
String of a URL to request instead.  
`reload: boolean | undefined`  
Boolean to indicate the page should be reloaded.  
`timing: Object.<(number|string|boolean)> | undefined`  
Map of timing attributes to timestamp numbers.  
`title: string | undefined`  
String of the new Document title.  
`url: string | undefined`  
String of the correct URL for the current request. This will replace the
current URL in history.  


### spf.MultipartResponse

**Class**  
Definition for a multipart SPF response object.

**Attributes**  
`cacheKey: string | undefined`  
String of the key used to cache this response.  
`cacheType: string | undefined`  
String of the type of caching to use for this response.  
`parts: Array.<spf.SingleResponse> | undefined`  
List of response objects.  
`timing: Object.<string, number> | undefined`  
Map of timing attributes to timestamp numbers.  
`type: string`  
The string "multipart".  


### spf.RequestOptions

**Class**  
Definition for options when requesting a URL.

**Attributes**  
`headers: Object.<string> | undefined`  
Optional map of headers to send with the request.  
`method: string | undefined`  
Optional method with which to send the request; defaults to "GET".  
`onError: function | undefined`  
Optional callback to execute if the request fails. The argument to the
callback will be an object that conforms to the [spf.EventDetail](#spf.eventdetail)
interface for "spferror" events (see [spf.Event](#spf.event)).  
`onRequest: function | undefined`  
Optional callback to execute before sending a SPF request. The argument
to the callback will be an object that conforms to the
[spf.EventDetail](#spf.eventdetail) interface for "spfrequest" events (see
[spf.Event](#spf.event)).  
`onPartProcess: function | undefined`  
Optional callback to execute upon receiving a part of a multipart SPF
response (see [spf.MultipartResponse](#spf.multipartresponse)).  Called before the part is
processed, once per part of multipart responses; never called for
single responses. If valid "X-SPF-Response-Type: multipart" and
"Transfer-Encoding: chunked" headers are sent, then this callback will be
executed on-the-fly as chunks are received.  The argument to the
callback will be an object that conforms to the [spf.EventDetail](#spf.eventdetail)
interface for "spfpartprocess" events (see [spf.Event](#spf.event)).  
`onPartDone: function | undefined`  
Optional callback to execute after processing a part of a multipart SPF
response (see [spf.MultipartResponse](#spf.multipartresponse)). Called once per part of
multipart responses; never called for single responses. If valid
"X-SPF-Response-Type: multipart" and "Transfer-Encoding: chunked"
headers are sent, then this callback will be executed on-the-fly as
chunks are received. The argument to the callback will be an object
that conforms to the [spf.EventDetail](#spf.eventdetail) interface for
"spfpartdone" events (see [spf.Event](#spf.event)).  
`onProcess: function | undefined`  
Optional callback to execute upon receiving a single SPF response (see
[spf.SingleResponse](#spf.singleresponse)). Called before the response is processed;
never called for multipart responses. The argument to the callback will
be an object that conforms to the [spf.EventDetail](#spf.eventdetail) interface for
"spfprocess" events (see [spf.Event](#spf.event)).  
`onDone: function | undefined`  
Optional callback to execute when the response is done being processed.
Called once as the last event for both single and multipart responses (see
[spf.SingleResponse](#spf.singleresponse) and [spf.MultipartResponse](#spf.multipartresponse)).  The argument
to the callback will be an object that conforms to the
[spf.EventDetail](#spf.eventdetail) interface for "spfdone" events (see
[spf.Event](#spf.event)).  
`postData: ArrayBuffer | Blob | Document | FormData | null | string | undefined`  
Optional data to send with the request.  Only used if the method is "POST".  


### spf.Event

**Class**  
Definition of CustomEvents dispatched by SPF.

**Attributes**  
`detail: spf.EventDetail`  
Optional detail object of the custom event.  


### spf.EventDetail

**Class**  
Definition of the CustomEvent "detail" attribute (see [spf.Event](#spf.event)),
also used as an argument to callbacks in [spf.RequestOptions](#spf.requestoptions) objects.

**Attributes**  
`err: Error | undefined`  
The Error that occurred; defined for "spferror" events,  
`name: string | undefined`  
The name of the scripts or stylesheets that will be unloaded; defined for
"spfjsbeforeunload", "spfjsunload", "spfcssbeforeunload", and
"spfcssunload" events.  
`part: spf.SingleResponse | undefined`  
One part of a multipart SPF response (see [spf.MultipartResponse](#spf.multipartresponse));
defined for "spfpartprocess" and "spfpartdone" events.  
`previous: string | undefined`  
The URL of the previous page; defined for "spfhistory" and
"spfrequest" events.  
`reason: `  
A string containing a reason code and a text explanation (debug only);
defined for the "spfreload" event.  
`referer: string | undefined`  
The URL of the previous page; defined for "spfhistory" and
"spfrequest" events.  
`response: spf.SingleResponse | spf.MultipartResponse | undefined`  
A complete SPF response; defined for "spfprocess" events as a single
response and for "spfdone" events as either a single or multipart
response (see [spf.SingleResponse](#spf.singleresponse) and [spf.MultipartResponse](#spf.multipartresponse).  
`xhr: XMLHttpRequest | undefined`  
A complete XMLHttpRequest object; defined for "onError" events.  
`target: Element | undefined`  
The target element of a click; defined for "spfclick" events.  
`url: string | undefined`  
The URL of the request; defined for "spferror", "spfreload", "spfclick",
"spfhistory", "spfrequest", "spfpartprocess", "spfpartdone", "spfprocess",
and "spfdone" events - or - the URL of the script or stylesheet that will
be unloaded; defined for "spfjsbeforeunload", "spfjsunload",
"spfcssbeforeunload", and "spfcssunload" events.  


### spf.TaskScheduler

**Class**  
Definition of the Scheduler API which can be used by the application to
control execution of tasks.

### spf.TaskScheduler#addTask

**Function**  
`spf.TaskScheduler#addTask(task)`  
Adds a task to the scheduler, it is expected to be executed asynchronously as
determined by the scheduler.

**Parameters**  
`task: function`  
The task to execute.  

**Returns**  
`number`  
The ID identifying the task.  


### spf.TaskScheduler#cancelTask

**Function**  
`spf.TaskScheduler#cancelTask(id)`  
Cancels a task if it has not been executed yet.

**Parameters**  
`id: number`  
The ID of the task to cancel.  




* * *

## spf.cache

Namespace for cache handling functions.

### spf.cache.remove

**Function**  
`spf.cache.remove(key)`  
Removes an entry from cache.

Removed entries will be completely removed from cache, affecting both normal
navigations as well as those triggered by a history change.

**Parameters**  
`key: string`  
The key to remove from cache.  


### spf.cache.clear

**Function**  
`spf.cache.clear()`  
Clear all entries from cache.

Removed entries will be completely removed from cache, affecting both normal
navigations as well as those triggered by a history change.



* * *

## spf.script

Namespace for script-loading functions.

### spf.script.load

**Function**  
`spf.script.load(url, name, opt_fn)`  
Loads a script asynchronously and defines a name to use for dependency
management and unloading.  See [spf.script.ready](#spf.script.ready) to wait for named
scripts to be loaded and [spf.script.unload](#spf.script.unload) to remove previously
loaded scripts.

- Subsequent calls to load the same URL will not reload the script.  To
  reload a script, unload it first with [spf.script.unload](#spf.script.unload).  To
  unconditionally load a script, see [spf.script.get](#spf.script.get).

- A name must be specified to identify the same script at different URLs.
  (For example, "main-A.js" and "main-B.js" are both "main".)  When a name
  is specified, all other scripts with the same name will be unloaded
  before the callback is executed.  This allows switching between
  versions of the same script at different URLs.

- A callback can be specified to execute once the script has loaded.  The
  callback will be executed each time, even if the script is not reloaded.

**Parameters**  
`url: string`  
URL of the script to load.  
`name: string`  
Name to identify the script.  
`opt_fn: function`  
Optional callback function to execute when the
    script is loaded.  


### spf.script.unload

**Function**  
`spf.script.unload(name)`  
Unloads a script identified by name.  See [spf.script.load](#spf.script.load).

NOTE: Unloading a script will prevent execution of ALL pending callbacks
but is NOT guaranteed to stop the browser loading a pending URL.

**Parameters**  
`name: string`  
The name of the script(s).  


### spf.script.get

**Function**  
`spf.script.get(url, opt_fn)`  
Unconditionally loads a script by dynamically creating an element and
appending it to the document without regard for dependencies or whether it
has been loaded before.  A script directly loaded by this method cannot
be unloaded by name.  Compare to [spf.script.load](#spf.script.load).

**Parameters**  
`url: string`  
The URL of the script to load.  
`opt_fn: function`  
Function to execute when loaded.  


### spf.script.ready

**Function**  
`spf.script.ready(names, opt_fn, opt_require)`  
Waits for one or more scripts identified by name to be loaded and executes
the callback function.  See [spf.script.load](#spf.script.load) or
[spf.script.done](#spf.script.done) to define names.

**Parameters**  
`names: string | Array.<string>`  
One or more names.  
`opt_fn: function`  
Callback function to execute when the
    scripts have loaded.  
`opt_require: function`  
Callback function to execute if names
    are specified that have not yet been defined/loaded.  


### spf.script.ignore

**Function**  
`spf.script.ignore(names, fn)`  
"Ignores" a script load by canceling execution of a pending callback.

Stops waiting for one or more scripts identified by name to be loaded and
cancels the pending callback execution.  The callback must have been
registered by [spf.script.load](#spf.script.load) or [spf.script.ready](#spf.script.ready).  If the
callback was registered by [spf.script.ready](#spf.script.ready) and more than one name
was provided, the same names must be used here.

**Parameters**  
`names: string | Array.<string>`  
One or more names.  
`fn: function`  
Callback function to cancel.  


### spf.script.done

**Function**  
`spf.script.done(name)`  
Notifies any waiting callbacks that `name` has completed loading.
Use with [spf.script.ready](#spf.script.ready) for arbitrary readiness not directly tied
to scripts.

**Parameters**  
`name: string`  
The ready name.  


### spf.script.require

**Function**  
`spf.script.require(names, opt_fn)`  
Recursively loads scripts identified by name, first loading
any dependendent scripts.  Use [spf.script.declare](#spf.script.declare) to define
dependencies.

**Parameters**  
`names: string | Array.<string>`  
One or more names.  
`opt_fn: function`  
Callback function to execute when the
    scripts have loaded.  


### spf.script.unrequire

**Function**  
`spf.script.unrequire(names)`  
Recursively unloads scripts identified by name, first unloading
any dependendent scripts.  Use [spf.script.declare](#spf.script.declare) to define
dependencies.

**Parameters**  
`names: string | Array.<string>`  
One or more names.  


### spf.script.declare

**Function**  
`spf.script.declare(deps, opt_urls)`  
Sets the dependency map and optional URL map used when requiring scripts.
See [spf.script.require](#spf.script.require).

**Parameters**  
`deps: Object.<(string|Array.<string>)>`  
The dependency map.  
`opt_urls: Object.<string>`  
The optional URL map.  


### spf.script.path

**Function**  
`spf.script.path(paths)`  
Sets the path prefix or replacement map to use when resolving relative URLs.

Note: The order in which replacements are made is not guaranteed.

**Parameters**  
`paths: string | Object.<string>`  
The paths.  


### spf.script.prefetch

**Function**  
`spf.script.prefetch(urls)`  
Prefetchs one or more scripts; the scripts will be requested but not loaded.
Use to prime the browser cache and avoid needing to request the script when
subsequently loaded.  See [spf.script.load](#spf.script.load).

**Parameters**  
`urls: string | Array.<string>`  
One or more URLs of scripts to prefetch.  



* * *

## spf.style

Namespace for stylesheet-loading functions.

### spf.style.load

**Function**  
`spf.style.load(url, name, opt_fn)`  
Loads a stylesheet asynchronously and defines a name to use for dependency
management and unloading.  See [spf.script.unload](#spf.script.unload) to remove previously
loaded stylesheets.

- Subsequent calls to load the same URL will not reload the stylesheet.  To
  reload a stylesheet, unload it first with [spf.script.unload](#spf.script.unload).  To
  unconditionally load a stylesheet, see [spf.script.get](#spf.script.get).

- A name must be specified to identify the same stylesheet at different URLs.
  (For example, "main-A.css" and "main-B.css" are both "main".)  When a name
  is specified, all other stylesheets with the same name will be unloaded.
  This allows switching between versions of the same stylesheet at different
  URLs.

- A callback can be specified to execute once the stylesheet has loaded.  The
  callback will be executed each time, even if the stylesheet is not
  reloaded.  NOTE: Unlike scripts, this callback is best effort and is
  supported in the following browser versions: IE 6, Chrome 19, Firefox 9,
  Safari 6.

**Parameters**  
`url: string`  
URL of the stylesheet to load.  
`name: string`  
Name to identify the stylesheet.  
`opt_fn: function`  
Optional callback function to execute when the
    stylesheet is loaded.  


### spf.style.unload

**Function**  
`spf.style.unload(name)`  
Unloads a stylesheet identified by name.  See [spf.script.load](#spf.script.load).

**Parameters**  
`name: string`  
Name of the stylesheet.  


### spf.style.get

**Function**  
`spf.style.get(url)`  
Unconditionally loads a stylesheet by dynamically creating an element and
appending it to the document without regard for whether it has been loaded
before. A stylesheet directly loaded by this method cannot be unloaded by
name.  Compare to [spf.script.load](#spf.script.load).

**Parameters**  
`url: string`  
URL of the stylesheet to load.  


### spf.style.path

**Function**  
`spf.style.path(paths)`  
Sets the path prefix or replacement map to use when resolving relative URLs.

Note: The order in which replacements are made is not guaranteed.

**Parameters**  
`paths: string | Object.<string>`  
The paths.  


### spf.style.prefetch

**Function**  
`spf.style.prefetch(urls)`  
Prefetchs one or more stylesheets; the stylesheets will be requested but not
loaded. Use to prime the browser cache and avoid needing to request the
stylesheet when subsequently loaded.  See [spf.script.load](#spf.script.load).

**Parameters**  
`urls: string | Array.<string>`  
One or more stylesheet URLs to prefetch.  


