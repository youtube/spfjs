/**
 * @fileoverview Definition of the beta version of the external SPF API.
 * @externs
 * @author nicksay@google.com (Alex Nicksay)
 */


/**
 * The top-level SPF namespace.
 * @noalias
 */
var spf = {};


/**
 * Definition for a single SPF response object.
 * @interface
 */
spf.SingleResponse;

/**
 * HTML string containing <link> and <style> tags of CSS to install.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.css;

/**
 * Map of Element IDs to HTML strings containing content of the Elements.
 * @type {Object.<string, string>|undefined}
 */
spf.SingleResponse.prototype.html;

/**
 * Map of Element IDs to maps of attibute names to values for the Elements.
 * @type {Object.<string, Object.<string, string>>|undefined}
 */
spf.SingleResponse.prototype.attr;

/**
 * HTML string containing <script> tags of JS to execute.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.js;

/**
 * String of the new Document title.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.title;

/**
 * Map of timing attributes to timestamp numbers.
 * @type {Object.<string, number>|undefined}
 */
spf.SingleResponse.prototype.timing;

/**
 * String of a URL to request instead.
 * @type {string|undefined}
 */
spf.SingleResponse.prototype.redirect;


/**
 * Definition for a multipart SPF response object.
 * @interface
 */
spf.MultipartResponse;

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
 * Optional callback to execute if the request fails. The first argument is the
 * requested URL; the second argument is the Error that occurred.
 * @type {function(string, Error)|undefined}
 */
spf.RequestOptions.prototype.onError;

/**
 * Optional callback to execute upon receiving a part of a multipart SPF
 * response (see {@link spf.MultipartResponse}).  Called before
 * {@code onSuccess}, once per part of multipart responses; never called for
 * single responses. If valid "X-SPF-Response-Type: multipart" and
 * "Transfer-Encoding: chunked" headers are sent, then this callback will be
 * executed on-the-fly as chunks are received.  The first argument is the
 * requested URL; the second is the partial response object.
 * @type {function(string, spf.SingleResponse)|undefined}
 */
spf.RequestOptions.prototype.onPart;

/**
 * Optional callback to execute if the request succeeds.  The first argument is
 * the requested URL; the second is the response object.  The response object
 * will be either a complete single response object or a complete multipart
 * response object
 * @type {function(string,(spf.SingleResponse|spf.MultipartResponse))|undefined}
 */
spf.RequestOptions.prototype.onSuccess;

/**
 * Optional data to send with the request.  Only used if the method is "POST".
 * @type {ArrayBuffer|Blob|Document|FormData|null|string|undefined}
 */
spf.RequestOptions.prototype.postData;


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
 * use for dependency management.  See {@link #ready} to wait for named scripts
 * to be loaded.
 *
 * - Subsequent calls to load the same URL will not reload the script.  To
 *   reload a script, unload it first with {@link #unload}
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be execute each time, even if the script is not reloaded.
 *
 * - A name can be specified to identify the same script at different URLs.
 *   (For example, "main-A.js" and "main-B.js" are both "main".)  If a name
 *   is specified, all other scripts with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same script at different URLs.
 *
 * @param {string|Array.<string>} urls One or more urls of scripts to load.
 * @param {(string|Function)=} opt_nameOrCallback Name to identify the script(s)
 *     independently or a callback to execute when the script is loaded.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 */
spf.script.load = function(urls, opt_nameOrCallback, opt_callback) {};


/**
 * Loads multiple scripts asynchronously in sequential order and optionally
 * defines a name to use for dependency management.  See {@link #load} for
 * non-sequential loading and {@link #ready} to wait for named scripts
 * to be loaded.
 *
 * @param {Array.<string>} urls An array for scripts to load sequentially.
 * @param {(string|Function)=} opt_nameOrCallback Name to identify the script
 *     independently or a callback to execute when the script is loaded.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 */
spf.script.order = function(urls, opt_nameOrCallback, opt_callback) {};

/**
 * Unconditionally loads a script by dynamically creating an element and
 * appending it to the document without regard for dependencies or whether it
 * has been loaded before.  Compare to {@link #load}.
 *
 * @param {string} url The URL of the script to load.
 * @param {Function=} opt_callback Function to execute when loaded.
 * @return {Element} The newly created script element.
 */
spf.script.get = function(url, opt_callback) {};


/**
 * Waits for one or more scripts identified by name to be loaded and executes
 * the callback function.  See {@link #load} or {@link #done} to define names.
 *
 * @param {string|Array.<string>} deps One or more dependencies names.
 * @param {Function=} opt_callback Callback function to execute when the
 *     scripts have loaded.
 * @param {Function=} opt_require Callback function to execute if dependencies
 *     are specified that have not yet been defined/loaded.
 */
spf.script.ready = function(deps, opt_callback, opt_require) {};


/**
 * Notifies any waiting callbacks that {@code name} has completed loading.
 * Use with {@link #ready} for arbitrary readiness not directly tied to scripts.
 *
 * @param {string} name The ready name.
 */
spf.script.done = function(name) {};
