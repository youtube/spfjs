// Copyright 2014 Google Inc. All rights reserved.
//
// Use of this source code is governed by The MIT License.
// See the LICENSE file for details.

/**
 * @fileoverview Provides a mechanism for adding tracing points into compiled
 * code to use various tools for profiling/tuning the application.
 * Most of the APIs are designed for use with the Web Tracing Framework, though
 * the core methods have fallbacks to the native `console` API.
 *
 * Use discretion when adding tracing methods - tracing can easily suffer under
 * the tragedy of the commons, with too many tracing calls making the traces
 * difficult to understand or distorting times so much as to make the results
 * useless. Only check in what you think you'll use in a months time, and if
 * traces stop being useful remove them.
 *
 * To get started you can easily instrument methods of a type by adding the
 * following to the bottom of your class definition file:
 * <code>
 * if (spf.tracing.ENABLED) {
 *   (function() {
 *     var proto = my.Class.prototype;
 *     spf.tracing.traceMethods('my.Class', proto, {
 *       'method1': proto.method1,
 *       'method2': proto.method2
 *     });
 *   })();
 * }
 * </code>
 *
 * This will cause all calls to method1 and method2 to be traced to either
 * the Web Tracing Framework or console.time/timeEnd as 'MyPrefix#method1' and
 * 'MyPrefix#method2'.
 *
 * Note that the function object, not just the function name, must be passed in.
 * This is to get around the fact that function names are typically obfuscated
 * by the JsCompiler.  Likewise, the name must be *quoted*, or it too will be
 * obfuscated.  Finally, wrapping the "var proto = ..." statement and the
 * call to traceMethods in an anonymous function is necessary to avoid the
 * "proto" variable entering the globe namespace (and colliding with other
 * similarly defined "proto" variables at other tracing sites).
 *
 * The naming convention used by the tracing methods is that of jsdoc. Deviating
 * from this scheme may result in broken traces.
 * Examples:
 *   Constructor: my.namespace.Type
 *   Method: my.namespace.Type#someMethod
 *   Anonymous callback: my.namespace.Type#method:callback
 * Any other special characters (such as [] and ()) may cause things to explode.
 *
 * Caveats:
 * -- This wraps your functions inside anonymous functions, and thus may
 * cause a slight performance hit.  Do NOT use in production code.
 * -- time() and timeEnd() will spam your console.  If the console is open,
 * you'll see a giant performance hit, invalidating your timings.
 * -- Recursive methods will produce nonsensical results.
 *
 * @author zhaoz@google.com (Ziling Zhao)
 */

goog.provide('spf.tracing');

goog.require('WTF');
goog.require('WTF.data.EventFlag');
goog.require('WTF.trace');


/**
 * @define {boolean} Turn trace stats collecting for WTF or the native browser
 *     tracing features (such as chrome:tracing).
 *
 * DO NOT ENABLE THIS IN PRODUCTION CODE!
 *
 * To use set SPF_TRACING to true using one of the following
 * two methods:
 *    a. Modify your build setup to pass the following flags to the JsCompiler:
 *         --define SPF_TRACING
 *       Then rebuild.
 *    b. Just edit the value below (preserves edit-refresh).
 *
 * Web Tracing Framework (WTF):
 * 1. Install the WTF Chrome extension: http://go/wtf-install
 * 2. Open your app. Click the small circle in the right of the page URL bar.
 * 3. The circle will turn red and the page will reload - you are now tracing
 *    and should perform whatever action you want traced.
 * 4. Capture a snapshot.
 *    a. Click the 'Send to UI' button (or hit F9) to view a snapshot.
 *       You can do this several times to update to new snapshots.
 *    b. Click the 'Save' button (or hit F10) to save a trace to disk for later
 *       viewing.
 *
 * chrome:tracing:
 * 1. Open a new tab in chrome and enter 'about:tracing' into the address bar to
 *    open chrome's about:tracing tool.
 * 2. Hit the 'Record' button.
 * 3. Go back to the program window and perform whatever action you want
 *    profiled.
 * 4. Go back to the tracing tab and click the 'Stop Tracing' button.
 * 5. You should see the named Job Steps in the trace stats under chrome's
 *    'v8.callFunction'.
 * See http://www.html5rocks.com/en/tutorials/games/abouttracing/ for more
 * details on chrome's about:tracing tool.
 */
spf.tracing.ENABLED = SPF_TRACING;


/**
 * A hook that can be manipulated at runtime to disable tracing even if it is
 * compiled in. Note that it must be set before this file is parsed, and
 * cannot be changed within a session.
 * @private {boolean}
 * @const
 */
spf.tracing.RUNTIME_DISABLED_ =
    window['_spf_tracing_runtime_disabled'] || false;


/**
 * Whether the Web Tracing Framework should be used.
 * This is only active when the master tracing flag
 * ({@see spf.tracing#ENABLED}) is enabled at compile time and WTF is
 * present on the page at runtime.
 * @private {boolean}
 * @const
 */
spf.tracing.USE_WTF_ =
    spf.tracing.ENABLED &&
    !spf.tracing.RUNTIME_DISABLED_ &&
    WTF.PRESENT;


/**
 * Whether to fallback to the `console` APIs when WTF is not present.
 * @private {boolean}
 * @const
 */
spf.tracing.USE_CONSOLE_ =
    spf.tracing.ENABLED &&
    !spf.tracing.RUNTIME_DISABLED_ &&
    !WTF.PRESENT &&
    !!window.console &&
    !!window.console.time &&
    !!window.console.timeEnd;


/**
 * Empty function that does nothing.
 *
 * Used to allow compiler to optimize away functions.
 */
spf.tracing.nullFunction = function() {};


/**
 * Identity function that returns its first argument.
 *
 * @param {T=} opt_returnValue The single value that will be returned.
 * @param {...*} var_args Optional trailing arguments. These are ignored.
 * @return {T} The first argument.
 * @template T
 */
 spf.tracing.identityFunction = function(opt_returnValue, var_args) {
   return opt_returnValue;
 };


/**
 * Initializes on* event properties on the given DOM element and optionally
 * for all children.
 * This must be called to ensure the properties work correctly. It can be
 * called repeatedly on the same elements (but you should avoid that). Try
 * calling it after any new DOM tree is added recursively on the root of the
 * tree.
 *
 * If this method is not called not all browsers will report events registered
 * via their on* properties. Events registered with addEventListener will always
 * be traced.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {!Element} target Target DOM element.
 * @param {boolean=} opt_recursive Also initialize for all children.
 */
spf.tracing.initializeDomEventProperties = spf.tracing.USE_WTF_ ?
    WTF.trace.initializeDomEventProperties : spf.tracing.nullFunction;


/**
 * Creates and registers a new event type, returning a function that can be used
 * to trace the event in the WTF event stream.
 * Created events should be cached and reused - do *not* redefine events.
 *
 * Events are defined by a signature that can be a simple string such as
 * `"myEvent"` or a reference string like `"namespace.Type#method"`
 * and can optionally include typed parameters like
 * `"myEvent(uint32 a, ascii b)"`.
 *
 * For more information on this API, see:
 * https://github.com/google/tracing-framework/blob/master/docs/api.md
 *
 * When tracing is disabled {@link spf.tracing.nullFunction} will be returned
 * for all events.
 *
 * Example:
 * <code>
 * // Create the event once, statically.
 * my.Type.fooEvent_ = spf.tracing.createInstanceEvent(
 *     'my.Type#foo(uint32 a, ascii b)');
 * my.Type.prototype.someMethod = function() {
 *   // Trace the event each function call with custom args.
 *   my.Type.fooEvent_(123, 'hello');
 * };
 * </code>
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {string} signature Event signature.
 * @param {number=} opt_flags A bitmask of {@see WTF.data.EventFlag} values.
 * @return {Function} New event type.
 */
spf.tracing.createInstanceEvent = spf.tracing.USE_WTF_ ?
    WTF.trace.events.createInstance : function(signature, opt_flags) {
      return spf.tracing.nullFunction;
    };


/**
 * Similar to {@see spf.tracing.createInstanceEvent}, but creates an
 * event that appends data to the current scope.
 *
 * @param {string} signature Event signature.
 * @return {Function} New event type.
 */
spf.tracing.createAppendScopeDataEvent = function(signature) {
  return spf.tracing.createInstanceEvent(
      signature, WTF.data.EventFlag.APPEND_SCOPE_DATA);
};


/**
 * Creates and registers a new event type, returning a function that can be used
 * to trace the event in the WTF event stream.
 * Created events should be cached and reused - do *not* redefine events.
 *
 * Events are defined by a signature that can be a simple string such as
 * `"myEvent"` or a reference string like `"namespace.Type#method"`
 * and can optionally include typed parameters like
 * `"myEvent(uint32 a, ascii b)"`.
 *
 * For more information on this API, see:
 *
 * When tracing is disabled {@link spf.tracing.nullFunction} will be returned
 * for all events.
 *
 * Example:
 * <code>
 * // Create the event once, statically.
 * my.Type.someMethodEvent_ = spf.tracing.createScopeEvent(
 *     'my.Type#foo(uint32 a, ascii b)');
 * my.Type.prototype.someMethod = function() {
 *   // Enter and leave each function call with custom args.
 *   var scope = my.Type.someMethodEvent_(123, 'hello');
 *   var result = 5; // ...
 *   return spf.tracing.leaveScope(scope, result);
 * };
 * </code>
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {string} signature Event signature.
 * @param {number=} opt_flags A bitmask of {@see WTF.data.EventFlag} values.
 * @return {Function} New event type.
 */
spf.tracing.createScopeEvent = spf.tracing.USE_WTF_ ?
    WTF.trace.events.createScope : function(signature, opt_flags) {
      return spf.tracing.nullFunction;
    };


/**
 * Wrap the instance methods provided with tracing scope calls.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present
 * or console.timeStart/timeEnd are available.
 *
 * @param {string} prefix A common prefix to use for all trace labels.
 * @param {!Object} classPrototype The prototype of the class.
 * @param {!Object.<!Function>} methodMap A mapping between method names
 *     and the methods themselves.
 */
spf.tracing.traceMethods = spf.tracing.USE_WTF_ ?
    WTF.trace.instrumentTypeSimple : spf.tracing.nullFunction;


/**
 * Enters a call scope.
 * This should only be used for scopes that are named at runtime.
 * If possible use {@see #traceMethods} to automatically wrap functions with
 * scopes. If you cannot, try using {@see createScopeEvent} to create a static
 * scope enter event that is an order of magnitude (or two) faster than using
 * this method. Only as a last resort should you use this method.
 *
 * To add additional data arguments to a scope use {@see #appendScopeData}.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present
 * or console.timeStart is available.
 *
 * @param {string} name Scope name.
 * @return {WTF.trace.Scope} An initialized scope object.
 */
spf.tracing.enterScope = spf.tracing.USE_WTF_ ?
    WTF.trace.enterScope : spf.tracing.nullFunction;


/**
 * Leaves a scope previously entered with {@see #enterScope} or a custom
 * scope event created with {@see #createScopeEvent}.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present
 * or console.timeEnd is available.
 *
 * @param {WTF.trace.Scope} scope Scope to leave.
 * @param {T=} opt_result Optional result to chain.
 * @return {T|undefined} The value of the `opt_result` parameter.
 * @template T
 */
spf.tracing.leaveScope = spf.tracing.USE_WTF_ ?
    WTF.trace.leaveScope : spf.tracing.nullFunction;


/**
 * Appends a named argument of any type to the currently traced method scope.
 * The data added is keyed by name, and existing data with the same name will
 * be overwritten.
 * This is slow and should only be used for very infrequent actions.
 * Prefer instead to use a custom instance event with the
 * {@see WTF.data.EventFlag#APPEND_SCOPE_DATA} flag set.
 *
 * Example:
 * <code>
 * my.Type.protoype.someMethod = function() {
 *   // This method is traced automatically by traceMethods, but more data
 *   // is needed:
 *   spf.tracing.appendMethodData('bar', 123);
 *   spf.tracing.appendMethodData('foo', {
 *     'complex': ['data']
 *   });
 * };
 * spf.tracing.traceMethods(...my.Type...);
 * </code>
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {string} name Argument name. Must be ASCII.
 * @param {*} value Value. Will be JSON stringified.
 */
spf.tracing.appendScopeData = spf.tracing.USE_WTF_ ?
    WTF.trace.appendScopeData : spf.tracing.nullFunction;


/**
 * Marks a stage on the timeline.
 * This can be used to indicate large changes in program execution, primarily
 * for tests that go through a series of steps (such as load/pan/zoom/etc).
 * Each mark is then turned into a navigation point in a table of contents.
 * This should only be used for modal application state changes, such as
 * initial load, entry into a modal dialog or mode, etc. There is only ever one
 * marked range active at a time and if you are calling this more frequently
 * than 1s you should use something else.
 *
 * For high-frequency time stamps instead use
 * {@see spf.tracing#timeStamp} and for async timers use
 * {@see spf.tracing#beginTimeRange}.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {string} name Marker name.
 * @param {*=} opt_value Optional data value.
 */
spf.tracing.markTimeline = spf.tracing.USE_WTF_ ?
    WTF.trace.mark : spf.tracing.nullFunction;


/**
 * Adds a time stamp to the timeline, indicating the occurrence of an event.
 * This is equivalent to the `console.timeStamp` method.
 * If you'd like a higher-performance variant or additional typed data, create
 * an instance event with {@see #createInstanceEvent}.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present
 * or console.timeStamp is defined.
 *
 * @param {string} name Time stamp name.
 * @param {*=} opt_value Optional data value.
 */
spf.tracing.timeStamp = spf.tracing.USE_WTF_ ?
    WTF.trace.timeStamp : spf.tracing.nullFunction;


/**
 * Begins an async timer.
 * This tracks time outside of normal scope flow control, and should be limited
 * to only those events that span frames or Javascript ticks.
 * If you're trying to track call flow instead use {@see #traceMethods}.
 *
 * A limited number of active timers will be displayed in the UI. Do not abuse
 * this feature by adding timers for everything. Prefer to use flows to track
 * complex async operations.
 *
 * Example:
 * <code>
 * my.Type.startJob = function(actionName) {
 *   var job = {...};
 *   job.tracingRange = spf.tracing.beginTimeRange(
 *       'my.Type:job', actionName);
 * };
 * my.Type.endJob = function(job) {
 *   spf.tracing.endTimeRange(job.tracingRange);
 * };
 * </code>
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {string} name Time range name.
 * @param {*=} opt_value Optional data value.
 * @return {WTF.trace.TimeRange} Time range handle.
 */
spf.tracing.beginTimeRange = spf.tracing.USE_WTF_ ?
    WTF.trace.beginTimeRange : spf.tracing.nullFunction;


/**
 * Ends an async time range previously started with {@see #beginTimeRange}.
 *
 * This is a no-op unless spf.tracing.ENABLED is true and WTF is present.
 *
 * @param {WTF.trace.TimeRange} timeRange Handle returned from
 *     {@see #beginTimeRange}.
 */
spf.tracing.endTimeRange = spf.tracing.USE_WTF_ ?
    WTF.trace.endTimeRange : spf.tracing.nullFunction;


/**
 * Automatically instruments a method.
 * This will likely produce code slower than manually instrumenting, but is
 * much more readable.
 *
 * <code>
 * my.Type.prototype.foo = WTF.trace.instrument(function(a, b) {
 *   return a + b;
 * }, 'my.Type.foo(uint8 b@1)');
 * </code>
 *
 * @param {T} value Target function.
 * @param {string} signature Method signature.
 * @param {string=} opt_namePrefix String to prepend to the name.
 * @param {(function(Function, Function):Function)=} opt_generator
 *     A custom function generator that is responsible for taking the given
 *     `value` and returning a wrapped function that emits the given
 *     event type.
 * @param {(function())=} opt_pre Code to execute before the scope is entered.
 *     This is only called if `opt_generator` is not provided.
 * @return {T} The instrumented input value.
 * @template T
 */
spf.tracing.instrument = spf.tracing.USE_WTF_ ?
    WTF.trace.instrument : spf.tracing.identityFunction;
