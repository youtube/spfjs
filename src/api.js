// Copyright 2014 Google Inc. All rights reserved.
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
 * @suppress {duplicate}
 * @noalias
 */
var spf = {};


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
 * Optional method with which to send the request; defaults to "GET".
 * @type {string|undefined}
 */
spf.RequestOptions.prototype.method;


/**
 * Optional callback to execute if the request fails. The argument to the
 * callback will be an object that conforms to the {@code spf.EventDetail}
 * interface for "spferror" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onError;


/**
 * Optional callback to execute before sending a SPF request. The argument
 * to the callback will be an object that conforms to the
 * {@code spf.EventDetail} interface for "spfrequest" events (see
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
 * callback will be an object that conforms to the {@code spf.EventDetail}
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
 * that conforms to the {@code spf.EventDetail} interface for
 * "spfpartdone" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onPartDone;


/**
 * Optional callback to execute upon receiving a single SPF response (see
 * {@link spf.SingleResponse}). Called before the response is processed;
 * never called for multipart responses. The argument to the callback will
 * be an object that conforms to the {@code spf.EventDetail} interface for
 * "spfprocess" events (see {@link spf.Event}).
 * @type {function(spf.EventDetail)|undefined}
 */
spf.RequestOptions.prototype.onProcess;


/**
 * Optional callback to execute when the response is done being processed.
 * Called once as the last event for both single and multipart responses (see
 * {@link spf.SingleResponse} and {@link spf.MultipartResponse}).  The argument
 * to the callback will be an object that conforms to the
 * {@code spf.EventDetail} interface for "spfdone" events (see
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
 * also used as an argument to callbacks in {@code spf.RequestOptions} objects.
 * @interface
 */
spf.EventDetail;


/**
 * The Error that occurred; defined for "spferror" events,
 * @type {Error|undefined}
 */
spf.EventDetail.prototype.err;


/**
 * The name of the scripts or styles that will be unloaded; defined for
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
 * The target element of a click; defined for "spfclick" events.
 * @type {Element|undefined}
 */
spf.EventDetail.prototype.target;


/**
 * The URL of the request; defined for "spferror", "spfreload", "spfclick",
 * "spfhistory", "spfrequest", "spfpartprocess", "spfpartdone", "spfprocess",
 * and "spfdone" events.
 * @type {string|undefined}
 */
spf.EventDetail.prototype.url;


/**
 * The list of URLs of the scripts or styles that will be unloaded; defined for
 * "spfjsbeforeunload", "spfjsunload", "spfcssbeforeunload", and
 * "spfcssunload" events.
 * @type {Array.<string>|undefined}
 */
spf.EventDetail.prototype.urls;


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
 * NOTE: Currently, the optional {@code onSuccess} and {@code onError}
 * callbacks are ignored in this function.  This will be fixed shortly.
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
 * simultaneous requests.  The content is first requested.  If the response is
 * successfully parsed, it is processed and the URL and response object are
 * passed to the optional {@code onSuccess} callback.  If not, the URL is passed
 * to the optional {@code onError} callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {(Object|spf.RequestOptions)=} opt_options Optional request options.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.load = function(url, opt_options) {};


/**
 * Process a response using the SPF protocol.
 *
 * @deprecated Use spf.load instead.
 *
 * @param {spf.SingleResponse|spf.MultipartResponse} response The SPF response
 *     object to process.
 */
spf.process = function(response) {};


/**
 * Prefetches a URL.
 *
 * Use to prime the SPF request cache with the content and the browser cache
 * with script and stylesheet URLs.
 *
 * The content is first requested.  If the response is successfully parsed, it
 * is preprocessed to prefetch scripts and stylesheets, and the URL and
 * response object are then passed to the optional {@code onSuccess}
 * callback. If not, the URL is passed to the optional {@code onError}
 * callback.
 *
 * @param {string} url The URL to prefetch, without the SPF identifier.
 * @param {(Object|spf.RequestOptions)=} opt_options Optional request options.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.prefetch = function(url, opt_options) {};


/**
 * Namespace for script-loading functions.
 */
spf.script = {};


/**
 * Loads one or more scripts asynchronously and optionally defines a name to
 * use for dependency management and unloading.  See {@link #ready} to wait
 * for named scripts to be loaded and {@link #unload} to remove previously
 * loaded scripts.
 *
 * - Subsequent calls to load the same URL will not reload the script.  To
 *   reload a script, unload it first with {@link #unload}.
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be executed each time, even if the script is not reloaded.
 *
 * - A name can be specified to identify the same script at different URLs.
 *   (For example, "main-A.js" and "main-B.js" are both "main".)  If a name
 *   is specified, all other scripts with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same script at different URLs.
 *
 * @param {string|Array.<string>} urls One or more URLs of scripts to load.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the script(s)
 *     or callback function to execute when the script is loaded.
 * @param {Function=} opt_fn Callback function to execute when the script is
 *     loaded.
 */
spf.script.load = function(urls, opt_nameOrFn, opt_fn) {};


/**
 * Unloads scripts identified by name.  See {@link #load}.
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
 * be unloaded by name.  Compare to {@link #load}.
 *
 * @param {string} url The URL of the script to load.
 * @param {Function=} opt_fn Function to execute when loaded.
 */
spf.script.get = function(url, opt_fn) {};


/**
 * Waits for one or more scripts identified by name to be loaded and executes
 * the callback function.  See {@link #load} or {@link #done} to define names.
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
 * registered by {@link #load} or {@link #ready}.  If the callback was
 * registered by {@link #ready} and more than one name was provided, the same
 * names must be used here.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function} fn Callback function to cancel.
 */
spf.script.ignore = function(names, fn) {};


/**
 * Notifies any waiting callbacks that {@code name} has completed loading.
 * Use with {@link #ready} for arbitrary readiness not directly tied to scripts.
 *
 * @param {string} name The ready name.
 */
spf.script.done = function(name) {};


/**
 * Recursively loads scripts identified by name, first loading
 * any dependendent scripts.  Use {@link #declare} to define dependencies.
 *
 * @param {string|Array.<string>} names One or more names.
 * @param {Function=} opt_fn Callback function to execute when the
 *     scripts have loaded.
 */
spf.script.require = function(names, opt_fn) {};


/**
 * Recursively unloads scripts identified by name, first unloading
 * any dependendent scripts.  Use {@link #declare} to define dependencies.
 *
 * @param {string|Array.<string>} names One or more names.
 */
spf.script.unrequire = function(names) {};


/**
 * Sets the dependency map and optional URL map used when requiring scripts.
 * See {@link #require}.
 *
 * @param {Object.<(string|Array.<string>)>} deps The dependency map.
 * @param {Object.<(string|Array.<string>)>=} opt_urls The optional URL map.
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
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of scripts to prefetch.
 */
spf.script.prefetch = function(urls) {};


/**
 * Namespace for style-loading functions.
 */
spf.style = {};


/**
 * Loads one or more styles asynchronously and optionally defines a name to
 * use for dependency management and unloading.  See {@link #unload} to
 * remove previously loaded styles.
 *
 * - Subsequent calls to load the same URL will not reload the style.  To
 *   reload a style, unload it first with {@link #unload}.
 *
 * - A callback can be specified to execute once the style has loaded.  The
 *   callback will be executed each time, even if the style is not reloaded.
 *   NOTE: Unlike scripts, this callback is best effort and is supported
 *   in the following browser versions: IE 6, Chrome 19, Firefox 9, Safari 6.
 *
 * - A name can be specified to identify the same style at different URLs.
 *   (For example, "main-A.css" and "main-B.css" are both "main".)  If a name
 *   is specified, all other styles with the same name will be unloaded.
 *   This allows switching between versions of the same style at different URLs.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to load.
 * @param {(string|Function)=} opt_nameOrFn Name to identify the style(s)
 *     or callback function to execute when the style is loaded.
 * @param {Function=} opt_fn Callback function to execute when the style is
 *     loaded.
 */
spf.style.load = function(urls, opt_nameOrFn, opt_fn) {};


/**
 * Unloads styles identified by name.  See {@link #load}.
 *
 * @param {string} name The name of the style(s).
 */
spf.style.unload = function(name) {};


/**
 * Unconditionally loads a style by dynamically creating an element and
 * appending it to the document without regard for whether it has been loaded
 * before. A style directly loaded by this method cannot be unloaded by name.
 * Compare to {@link #load}.
 *
 * @param {string} url The URL of the style to load.
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
 * Prefetchs one or more styles; the styles will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the style when
 * subsequently loaded.  See {@link #load}.
 *
 * @param {string|Array.<string>} urls One or more URLs of styles to prefetch.
 */
spf.style.prefetch = function(urls) {};
