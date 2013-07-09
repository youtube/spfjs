/**
 * @fileoverview Definition of the external SPF API.
 * @externs
 * @author nicksay@google.com (Alex Nicksay)
 */


/**
 * The top-level SPF namespace.
 * @noalias
 */
var spf = {};


/**
 * Initializes SPF.
 *
 * @param {Object=} opt_config Optional configuration object.
 * @return {boolean} Whether SPF was successfully initialized.  If the HTML5
 *     history modification API is not supported, returns false.
 */
spf.init = function(opt_config) {};


/**
 * Disposes SPF.
 */
spf.dispose = function() {};


/**
 * Navigates to a URL using the SPF protocol.  A pushState history entry is
 * added for the URL, and if successful, the navigation is performed.  If not,
 * the browser is redirected to the URL.
 *
 * During the navigation, first the content is requested.  If the reponse is
 * sucessfully parsed, it is processed by {@link spf.process}.
 * If not, the browser is redirected to the URL.  Only a single navigation
 * request can be in flight at once.  If a second URL is navigated to while a
 * first is still pending, the first will be cancelled.
 *
 * @param {string} url The URL to navigate to, without the SPF identifier.
 */
spf.navigate = function(url) {};


/**
 * Loads a URL using the SPF protocol.  Similar to {@link spf.navigate}, but
 * intended for traditional content updates, not page navigation.  Not subject
 * to restrictions on the number of simultaneous requests.  The content is
 * first requested.  If the response is successfully parsed, it is processed
 * by {@link spf.process}, and the URL and response object are passed
 * to the optional {@code opt_onSuccess} callback.  If not, the URL is passed
 * to the optional {@code opt_onError} callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the load succeeds.
 * @param {function(string, Error)=} opt_onError The callback to
 *     execute if the load fails. The first argument is the requested
 *     URL; the second argument is the Error that occurred.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.load = function(url, opt_onSuccess, opt_onError) {};


/**
 * Process a response using the SPF protocol.
 *
 * @param {!Object} response The SPF response object to process.
 */
spf.process = function(response) {};


/**
 * Prefetches a URL using the SPF protocol.  Use to prime the SPF request cache
 * with the content and the browser cache with script and stylesheet URLs.
 * The content is first requested.  If the response is successfully parsed, it
 * is preprocessed to prefetch scripts and stylesheets, and the URL and
 * response object are then passed to the optional {@code opt_onSuccess}
 * callback. If not, the URL is passed to the optional {@code opt_onError}
 * callback.
 *
 * @param {string} url The URL to load, without the SPF identifier.
 * @param {function(string, !Object)=} opt_onSuccess The callback to execute if
 *     the prefetch succeeds.
 * @param {function(string, Error)=} opt_onError The callback to
 *     execute if the prefetch fails. The first argument is the requested
 *     URL; the second argument is the Error that occurred.
 * @return {XMLHttpRequest} The XHR of the current request.
 */
spf.prefetch = function(url, opt_onSuccess, opt_onError) {};


/**
 * Namespace for script-loading functions.
 */
spf.scripts = {};


/**
 * Loads a script URL by dynamically creating an element and appending it to
 * the document.
 *
 * - Subsequent calls to load the same URL will not reload the script.  This
 *   is done by giving each script a unique element id based on the URL and
 *   checking for it prior to loading.  To reload a script, unload it first.
 *   {@link spf.scripts.unload}
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
 * @param {string} url Url of the script.
 * @param {Function=} opt_callback Callback function to execute when the
 *     script is loaded.
 * @param {string=} opt_name Name to identify the script independently
 *     of the URL.
 * @return {Element} The dynamically created script element.
 */
spf.scripts.load = function(url, opt_callback, opt_name) {};


/**
 * "Unloads" a script URL by finding a previously created element and
 * removing it from the document.  This will allow a URL to be loaded again
 * if needed.  Unloading a script will stop execution of a pending callback,
 * but will not stop loading a pending URL.
 *
 * @param {string} url Url of the script.
 */
spf.scripts.unload = function(url) {};


/**
 * "Ignores" a script load by canceling execution of any pending callbacks;
 * does not stop the actual loading of the script.
 *
 * @param {string} url Url of the script.
 */
spf.scripts.ignore = function(url) {};


/**
 * Prefetchs a script URL; the script will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the script when
 * subsequently loaded.  See {@link spf.scripts.load}.
 *
 * @param {string} url Url of the script.
 */
spf.scripts.prefetch = function(url) {};


/**
 * Namespace for stylesheet-loading functions.
 */
spf.styles = {};


/**
 * Loads a stylesheet URL by dynamically creating an element and appending it
 * to the document.
 *
 * - Subsequent calls to load the same URL will not reload the stylesheet.
 *   This is done by giving each stylesheet a unique element id based on the
 *   URL and checking for it prior to loading.  To reload a stylesheet,
 *   unload it first.  See {@link spf.styles.unload}.
 *
 * - A callback can be specified to execute once the script has loaded.  The
 *   callback will be execute each time, even if the script is not reloaded.
 *   NOTE: Unlike scripts, this callback is best effort and is supported
 *   in the following browser versions: IE 6, Chrome 19, Firefox 9, Safari 6.
 *
 * - A name can be specified to identify the same stylesheet at different URLs.
 *   (For example, "main-A.css" and "main-B.csss" are both "main".)  If a name
 *   is specified, all other stylesheet with the same name will be unloaded
 *   before the callback is executed.  This allows switching between
 *   versions of the same stylesheet at different URLs.
 *
 * @param {string} url Url of the stylesheet.
 * @param {Function=} opt_callback Callback function to execute when the
 *     stylesheet is loaded (best-effort execution only).
 * @param {string=} opt_name Name to identify the stylesheet independently
 *     of the URL.
 * @return {Element} The dynamically created link element.
 */
spf.styles.load = function(url, opt_callback, opt_name) {};


/**
 * "Unloads" a stylesheet URL by finding a previously created element and
 * removing it from the document.  This will remove the styles and allow a
 * URL to be loaded again if needed.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.styles.unload = function(url) {};


/**
 * "Ignores" a stylesheet load by canceling execution of any pending callbacks;
 * does not stop the actual loading of the stylesheet.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.styles.ignore = function(url) {};


/**
 * Prefetches a stylesheet URL; the stylesheet will be requested but not loaded.
 * Use to prime the browser cache and avoid needing to request the styesheet
 * when subsequently loaded.  See {@link spf.styles.load}.
 *
 * @param {string} url Url of the stylesheet.
 */
spf.styles.prefetch = function(url) {};
