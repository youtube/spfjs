---
title: Events
description: Handle SPF events and the navigation life cycle.
---


SPF is designed to give developers enough flexibility during
navigation to both control application logic and provide UI
updates for things like progress bars.


## Navigation Life Cycle

A basic event flow diagram follows and a more detailed
explanation is below:


           Navigation Life Cycle            Event Dispatched
                        +                                   
                        |                                   
                        |                                   
                        +---------------------->[ spfready ]
                        |                                   
                        |                                   
    +-------------------+                                   
    |                   |                                   
    |                   |                                   
    |     +----------------------------+                    
    |     |             |              |                    
    |  api|navigate  dom|click  history|popstate            
    |     |             |              |                    
    |     |             +------+-------+                    
    |     |                    |           +--->[ spfclick ]
    |     |                    +-----------+                
    |     |                    |           +->[ spfhistory ]
    |     +-------------+------+                            
    |                   |                                   
    |                   |                                   
    |                   +-------------------->[ spfrequest ]
    |                   |                                   
    |               send|request                            
    |                   |                                   
    |                   +--------------+                    
    |                   |              |                    
    |                   |       history|pushstate           
    |                   |              |                    
    |                   +--------------+                    
    |                   |                                   
    |                   |                                   
    |            receive|response                           
    |                   |                                   
    |                   +-------------------->[ spfprocess ]
    |                   |                                   
    |                   |                                   
    |            process|response                           
    |                   |                                   
    |                   +----------------------->[ spfdone ]
    |                   |                                   
    |                   |                                   
    +-------------------+                                   
                        |                                   
                        |                                   
                        v                                   


## Event Descriptions

All events in the [API][] are defined as [spf.Event][] objects.
A list of the events and their descriptions follows:

**`spfclick`**  
Fired when handling a click on a valid link (e.g. one with a
valid `spf-link` class or parent element).  Use as an early
indication that navigation will happen or to provide element-
level UI feedback.

**`spfhistory`**  
Fired when handling a `popstate` history event, indicating the
user has gone backward or forward; similar to `spfclick`.

**`spfrequest`**  
Fired before a request for navigation is sent.  Use to handle
the beginning of navigation and provide global-level UI feedback
(i.e. start a progress bar). This event is fired before a
request is sent for all types of navigation: clicks,
back/forward, and API calls.  (Note that this event is fired
even if a response is fetched from cache and no actual network
request is made.)

**`spfprocess`**  
Fired when a response has been received, either from the network
or from cache, before it is processed.  Use to update UI
feedback (i.e. advance a progress bar) and dispose event
listeners before content is updated.

**`spfdone`**  
Fired after response processing is done.  Use to finalize UI
feedback (i.e. complete a progress bar) and initialize event
listeners after content is updated.


## Callbacks and Cancellations

If manually starting navigation with [spf.navigate][], then
instead of handling events you may pass callbacks in an object
that conforms to the [spf.RequestOptions][] interface. Almost
all events and callbacks can be canceled by calling
`preventDefault` or returning `false`, respectively.  A list of
the events, their corresponding callbacks, and their cancel
action follows:

| Event        | Callback    | State                         | Cancel |
|:-------------|:------------|:------------------------------|:-------|
| `spfclick`   |             | Link Clicked                  | Ignore |
| `spfhistory` |             | Back/Forward Clicked          | Ignore |
| `spfrequest` | `onRequest` | Started; Sending Request      | Reload |
| `spfprocess` | `onProcess` | Processing; Response Received | Reload |
| `spfdone`    | `onDone`    | Done                          |        |



[API]: ../api.md
[spf.Event]: ../api.md#spf.event
[spf.navigate]: ../api.md#spf.navigate
[spf.RequestOptions]: ../api.md#spf.requestoptions
