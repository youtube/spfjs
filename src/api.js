// Copyright 2013 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Definition of the external SPF API.
 * @externs
 * @author nicksay@google.com (Alex Nicksay)
 */


/**
 * The top-level SPF namespace.
 * @namespace
 * @suppress {duplicate,strictMissingProperties}
 */
var spf = {};


/**
 * Initializes SPF.
 *
 * @param {Object=} opt_config Optional global configuration object.
 * @return {boolean} Whether SPF was successfully initialized.  If the HTML5
 *     history modification API is not supported, returns false.
 */
spf.init = function(opt_config) {};


/**
 * Disposes SPF.
 */
spf.dispose = function() {};


/**
 * Navigates to a URL.
 *
 * A pushState history entry is added for the URL, and if successful, the
 * navigation is performed.  If not, the browser is redirected to the URL.
 * During the navigation, first the content is requested.  If the reponse is
 * sucessfully parsed, it is processed.  If not, the browser is redirected to
 * the URL.  Only a single navigation request can be in flight at once.  If a
 * second URL is navigated to while a first is still pending, the first will be
 * cancelled.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 * @param {(Object|spf.RequestOptions)=} opt_options Optional request options.
 */
spf.navigate = function(url, opt_options) {};


/**
 * Loads a URL.
 *
 * Similar to {@link spf.navigate}, but intended for traditional content
 * updates, not page navigation.  Not subject to restrictions on the number of
 * simultaneous requests.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {(Object|spf.RequestOptions)=} opt_options Optional request options.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.load = function(url, opt_options) {};


/**
 * Process a SPF response on the current page outside of a navigation flow.
 *
 * @param {spf.SingleResponse|spf.MultipartResponse} response The SPF response
 *     object to process.
 * @param {function((spf.SingleResponse|spf.MultipartResponse))=} opt_callback
 *     Function to execute when processing is done; the argument is
 *     the `response`.
 */
spf.process = function(response, opt_callback) {};


/**
 * Prefetches a URL.
 *
 * Use to prime the SPF request cache with the content and the browser cache
 * with script and stylesheet URLs.  If the response is successfully parsed, it
 * is preprocessed to prefetch scripts and stylesheets as well.
 *
 * @param {string} url The URL to prefetch, without the SPF identifier.
 * @param {(Object|spf.RequestOptions)=} opt_options Optional request options.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.prefetch = function(url, opt_options) {};


/**
 * Definition for a single SPF response object.
 * @interface
 */
spf.SingleResponse;


/**
 * Map of Element IDs to maps of attibute names to values for the Elements.
 * @type {Object.<string, Object.<string, string>>|undefined}
 */
spf.SingleResponse.prototype.attr;


/**
 * Map of Element IDs to HTML strings containing content of the Elements.  The
 * content may contain script and/or style tags to be executed or installed.
 * @type {Object.<string, string>|undefined}
 */
spf.SingleResponse.prototype.body;


/**
 * String of the cache key used to store this response.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.cacheKey;


/**
 * String of the type of caching to use for this response.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.cacheType;


/**
 * Reserved for client data of any type.
 * @type {*|undefined}
 */
spf.SingleResponse.prototype.data;


/**
 * HTML string containing CSS and/or JS tags to execute or install.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.head;


/**
 * HTML string containing JS and/or CSS tags to execute or install.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.foot;


/**
 * String of a URL to request instead.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.redirect;


/**
 * Boolean to indicate the page should be reloaded.
 * @type {boolean|undefined}
 */
spf.SingleResponse.prototype.reload;


/**
 * Map of timing attributes to timestamp numbers.
 * @type {Object.<(number|string|boolean)>|undefined}
 */
spf.SingleResponse.prototype.timing;


/**
 * String of the new Document title.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.title;


/**
 * String of the correct URL for the current request. This will replace the
 * current URL in history.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.url;


/**
 * Definition for a multipart SPF response object.
 * @interface
 */
spf.MultipartResponse;


/**
 * String of the key used to cache this response.
 * @type {string|undefined}
 */
spf.MultipartResponse.prototype.cacheKey;


/**
 * String of the type of caching to use for this response.
 * @type {string|undefined}
 */
spf.MultipartResponse.prototype.cacheType;


/**
 * List of response objects.
 * @type {Array.<spf.SingleResponse>|undefined}
 */
spf.MultipartResponse.prototype.parts;


/**
 * Map of timing attributes to timestamp numbers.
 * @type {Object.<string, number>|undefined}
 */
spf.MultipartResponse.prototype.timing;


/**
 * The string "multipart".
 * @type {string}
 */
spf.MultipartResponse.prototype.type;


/**
 * Definition for options when requesting a URL.
 * @interface
 */
spf.RequestOptions;


/**
 * Optional map of headers to send with the request.
 * @type {Object.<string>|undefined}
 */
spf.RequestOptions.prototype.headers;


/**
 * Optional method with which to send the request; defaults to "GET".
 * @type {string|undefined}
 */
spf.RequestOptions.prototype.method;


/**
 * Optional callback to execute if the request fails. The argument to the
 * callback will be an object that conforms to the {@link spf.EventDetail}
 * interface for "spferror" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onError;


/**
 * Optional callback to execute before sending a SPF request. The argument
 * to the callback will be an object that conforms to the
 * {@link spf.EventDetail} interface for "spfrequest" events (see
 * {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onRequest;


/**
 * Optional callback to execute upon receiving a part of a multipart SPF
 * response (see {@link spf.MultipartResponse}).  Called before the part is
 * processed, once per part of multipart responses; never called for
 * single responses. If valid "X-SPF-Response-Type: multipart" and
 * "Transfer-Encoding: chunked" headers are sent, then this callback will be
 * executed on-the-fly as chunks are received.  The argument to the
 * callback will be an object that conforms to the {@link spf.EventDetail}
 * interface for "spfpartprocess" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onPartProcess;


/**
 * Optional callback to execute after processing a part of a multipart SPF
 * response (see {@link spf.MultipartResponse}). Called once per part of
 * multipart responses; never called for single responses. If valid
 * "X-SPF-Response-Type: multipart" and "Transfer-Encoding: chunked"
 * headers are sent, then this callback will be executed on-the-fly as
 * chunks are received. The argument to the callback will be an object
 * that conforms to the {@link spf.EventDetail} interface for
 * "spfpartdone" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onPartDone;


/**
 * Optional callback to execute upon receiving a single SPF response (see
 * {@link spf.SingleResponse}). Called before the response is processed;
 * never called for multipart responses. The argument to the callback will
 * be an object that conforms to the {@link spf.EventDetail} interface for
 * "spfprocess" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onProcess;


/**
 * Optional callback to execute when the response is done being processed.
 * Called once as the last event for both single and multipart responses (see
 * {@link spf.SingleResponse} and {@link spf.MultipartResponse}).  The argument
 * to the callback will be an object that conforms to the
 * {@link spf.EventDetail} interface for "spfdone" events (see
 * {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onDone;


/**
 * Optional data to send with the request.  Only used if the method is "POST".
 * @type {ArrayBuffer|Blob|Document|FormData|null|string|undefined}
 */
spf.RequestOptions.prototype.postData;


/**
 * Optional flag to configure the XHR to send withCredentials or not.
 * @type {boolean|undefined}
 */
spf.RequestOptions.prototype.withCredentials;


/**
 * Definition of CustomEvents dispatched by SPF.
 * @interface
 * @extends {CustomEvent}
 */
spf.Event;


/**
 * Optional detail object of the custom event.
 * @type {spf.EventDetail}
 */
spf.Event.prototype.detail;


/**
 * Definition of the CustomEvent "detail" attribute (see {@link spf.Event}),
 * also used as an argument to callbacks in {@link spf.RequestOptions} objects.
 * @interface
 */
spf.EventDetail;


/**
 * The Error that occurred; defined for "spferror" events,
 * @type {Error|undefined}
 */
spf.EventDetail.prototype.err;


/**
 * The name of the scripts or stylesheets that will be unloaded; defined for
 * "spfjsbeforeunload", "spfjsunload", "spfcssbeforeunload", and
 * "spfcssunload" events.
 * @type {string|undefined}
 */
spf.EventDetail.prototype.name;


/**
 * One part of a multipart SPF response (see {@link spf.MultipartResponse});
 * defined for "spfpartprocess" and "spfpartdone" events.
 * @type {spf.SingleResponse|undefined}
 */
spf.EventDetail.prototype.part;


/**
 * The URL of the previous page; defined for "spfhistory" and
 * "spfrequest" events.
 * @type {string|undefined}
 */
spf.EventDetail.prototype.previous;


/**
 * A string containing a reason code and a text explanation (debug only);
 * defined for the "spfreload" event.
 */
spf.EventDetail.prototype.reason;


/**
 * The URL of the previous page; defined for "spfhistory" and
 * "spfrequest" events.
 * @type {string|undefined}
 */
spf.EventDetail.prototype.referer;


/**
 * A complete SPF response; defined for "spfprocess" events as a single
 * response and for "spfdone" events as either a single or multipart
 * response (see {@link spf.SingleResponse} and {@link
 * spf.MultipartResponse}.
 * @type {spf.SingleResponse|spf.MultipartResponse|undefined}
 */
spf.EventDetail.prototype.response;

/**
 * A complete XMLHttpRequest object; defined for "onError" events.
 * @type {XMLHttpRequest|undefined}
 */
spf.EventDetail.prototype.xhr;

/**
 * The target element of a click; defined for "spfclick" events.
 * @type {Element|undefined}
 */
spf.EventDetail.prototype.target;


/**
 * The URL of the request; defined for "spferror", "spfreload", "spfclick",
 * "spfhistory", "spfrequest", "spfpartprocess", "spfpartdone", "spfprocess",
 * and "spfdone" events - or - the URL of the script or stylesheet that will
 * be unloaded; defined for "spfjsbeforeunload", "spfjsunload",
 * "spfcssbeforeunload", and "spfcssunload" events.
 * @type {string|undefined}
 */
spf.EventDetail.prototype.url;


/**
 * Definition of the Scheduler API which can be used by the application to
 * control execution of tasks.
 * @interface
 */
spf.TaskScheduler;


/**
 * Adds a task to the scheduler, it is expected to be executed asynchronously as
 * determined by the scheduler.
 *
 * @param {!Function} task The task to execute.
 * @return {number} The ID identifying the task.
 */
spf.TaskScheduler.prototype.addTask = function(task) {};


/**
 * Cancels a task if it has not been executed yet.
 *
 * @param {number} id The ID of the task to cancel.
 */
spf.TaskScheduler.prototype.cancelTask = function(id) {};


/**
 * Namespace for cache handling functions.
 * @namespace
 */
spf.cache = {};


/**
 * Removes an entry from cache.
 *
 * Removed entries will be completely removed from cache, affecting both normal
 * navigations as well as those triggered by a history change.
 *
 * @param {string} key The key to remove from cache.
 */
spf.cache.remove = function(key) {};


/**
 * Clear all entries from cache.
 *
 * Removed entries will be completely removed from cache, affecting both normal
 * navigations as well as those triggered by a history change.
 */
spf.cache.clear = function() {};


/**
 * Namespace for script-loading functions.
 * @namespace
 */
spf.script = {};


/**
 * Loads a script asynchronously and defines a name to use for dependency
 * management and unloading.  See {@link spf.script.ready} to wait for named
 * scripts to be loaded and {@link spf.script.unload} to remove previously
 * loaded scripts.
 *
 * - Subsequent calls to load the same URL will not reload the script.  To
 *   reload a script, unload it first with {@link spf.script.unload}.  To
 *   unconditionally load a script, see {@link spf.script.get}.
 *
 * - A name must be specified to identify the same script at different URLs.
 *   (For example, "main-A.js" and "main-B.js" are both "main".)  When a name
 *   is specified, all other scripts with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same script at different URLs.
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be executed each time, even if the script is not reloaded.
 *
 * @param {string} url URL of the script to load.
 * @param {string} name Name to identify the script.
 * @param {Function=} opt_fn Optional callback function to execute when the
 *     script is loaded.
 */
spf.script.load = function(url, name, opt_fn) {};


/**
 * Unloads a script identified by name.  See {@link spf.script.load}.
 *
 * NOTE: Unloading a script will prevent execution of ALL pending callbacks
 * but is NOT guaranteed to stop the browser loading a pending URL.
 *
 * @param {string} name The name of the script(s).
 */
spf.script.unload = function(name) {};


/**
 * Unconditionally loads a script by dynamically creating an element and
 * appending it to the document without regard for dependencies or whether it
 * has been loaded before.  A script directly loaded by this method cannot
 * be unloaded by name.  Compare to {@link spf.script.load}.
 *
 * @param {string} url The URL of the script to load.
 * @param {Function=} opt_fn Function to execute when loaded.
 */
spf.script.get = function(url, opt_fn) {};


/**
 * Waits for one or more scripts identified by name to be loaded and executes
 * the callback function.  See {@link spf.script.load} or
 * {@link spf.script.done} to define names.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function=} opt_fn Callback function to execute when the
 *     scripts have loaded.
 * @param {Function=} opt_require Callback function to execute if names
 *     are specified that have not yet been defined/loaded.
 */
spf.script.ready = function(names, opt_fn, opt_require) {};


/**
 * "Ignores" a script load by canceling execution of a pending callback.
 *
 * Stops waiting for one or more scripts identified by name to be loaded and
 * cancels the pending callback execution.  The callback must have been
 * registered by {@link spf.script.load} or {@link spf.script.ready}.  If the
 * callback was registered by {@link spf.script.ready} and more than one name
 * was provided, the same names must be used here.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function} fn Callback function to cancel.
 */
spf.script.ignore = function(names, fn) {};


/**
 * Notifies any waiting callbacks that `name` has completed loading.
 * Use with {@link spf.script.ready} for arbitrary readiness not directly tied
 * to scripts.
 *
 * @param {string} name The ready name.
 */
spf.script.done = function(name) {};


/**
 * Recursively loads scripts identified by name, first loading
 * any dependendent scripts.  Use {@link spf.script.declare} to define
 * dependencies.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function=} opt_fn Callback function to execute when the
 *     scripts have loaded.
 */
spf.script.require = function(names, opt_fn) {};


/**
 * Recursively unloads scripts identified by name, first unloading
 * any dependendent scripts.  Use {@link spf.script.declare} to define
 * dependencies.
 *
 * @param {string|Array.<string>} names One or more names.
 */
spf.script.unrequire = function(names) {};


/**
 * Sets the dependency map and optional URL map used when requiring scripts.
 * See {@link spf.script.require}.
 *
 * @param {Object.<(string|Array.<string>)>} deps The dependency map.
 * @param {Object.<string>=} opt_urls The optional URL map.
 */
spf.script.declare = function(deps, opt_urls) {};


/**
 * Sets the path prefix or replacement map to use when resolving relative URLs.
 *
 * Note: The order in which replacements are made is not guaranteed.
 *
 * @param {string|Object.<string>} paths The paths.
 */
spf.script.path = function(paths) {};


/**
 * Prefetchs one or more scripts; the scripts will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the script when
 * subsequently loaded.  See {@link spf.script.load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of scripts to prefetch.
 */
spf.script.prefetch = function(urls) {};


/**
 * Namespace for stylesheet-loading functions.
 * @namespace
 */
spf.style = {};


/**
 * Loads a stylesheet asynchronously and defines a name to use for dependency
 * management and unloading.  See {@link spf.script.unload} to remove previously
 * loaded stylesheets.
 *
 * - Subsequent calls to load the same URL will not reload the stylesheet.  To
 *   reload a stylesheet, unload it first with {@link spf.script.unload}.  To
 *   unconditionally load a stylesheet, see {@link spf.script.get}.
 *
 * - A name must be specified to identify the same stylesheet at different URLs.
 *   (For example, "main-A.css" and "main-B.css" are both "main".)  When a name
 *   is specified, all other stylesheets with the same name will be unloaded.
 *   This allows switching between versions of the same stylesheet at different
 *   URLs.
 *
 * - A callback can be specified to execute once the stylesheet has loaded.  The
 *   callback will be executed each time, even if the stylesheet is not
 *   reloaded.  NOTE: Unlike scripts, this callback is best effort and is
 *   supported in the following browser versions: IE 6, Chrome 19, Firefox 9,
 *   Safari 6.
 *
 * @param {string} url URL of the stylesheet to load.
 * @param {string} name Name to identify the stylesheet.
 * @param {Function=} opt_fn Optional callback function to execute when the
 *     stylesheet is loaded.
 */
spf.style.load = function(url, name, opt_fn) {};


/**
 * Unloads a stylesheet identified by name.  See {@link spf.script.load}.
 *
 * @param {string} name Name of the stylesheet.
 */
spf.style.unload = function(name) {};


/**
 * Unconditionally loads a stylesheet by dynamically creating an element and
 * appending it to the document without regard for whether it has been loaded
 * before. A stylesheet directly loaded by this method cannot be unloaded by
 * name.  Compare to {@link spf.script.load}.
 *
 * @param {string} url URL of the stylesheet to load.
 */
spf.style.get = function(url) {};


/**
 * Sets the path prefix or replacement map to use when resolving relative URLs.
 *
 * Note: The order in which replacements are made is not guaranteed.
 *
 * @param {string|Object.<string>} paths The paths.
 */
spf.style.path = function(paths) {};


/**
 * Prefetchs one or more stylesheets; the stylesheets will be requested but not
 * loaded. Use to prime the browser cache and avoid needing to request the
 * stylesheet when subsequently loaded.  See {@link spf.script.load}.
 *
 * @param {string|Array.<string>} urls One or more stylesheet URLs to prefetch.
 */
spf.style.prefetch = function(urls) {};
