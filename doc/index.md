---
title: SPF
layout: home
---


## A lightweight JS framework for fast navigation and page updates from YouTube


Using progressive enhancement and HTML5, SPF integrates with
your site to enable a faster, more fluid user experience by
updating just the sections of the page that change during
navigation, not the whole page.  SPF provides a response format
for sending document fragments, a robust system for script and
style management, an in-memory cache, on-the-fly processing, and
more.


## Navigation

When someone first arrives at your site, content is sent from
the server and rendered normally.  This is _static_ navigation.
But when going to the next page, only document fragments are
sent, and the changed sections are updated accordingly. This is
_dynamic_ navigation.

1.  Static: render everything.
    ![Static Navigation][]

2.  Dynamic: only render new fragments.
    ![Dynamic Navigation][]


## Overview

SPF allows you to leverage the benefits of a static initial page
load, while gaining the performance and user experience benefits
of dynamic page loads:

> **User Experience**
>
> - Get the fastest possible initial page load.  
> - Keep a responsive persistent interface during navigation.  

<!-- -->

> **Performance**
>
> - Leverage existing techniques for static rendering.  
> - Load small responses and fewer resources each navigation.  

<!-- -->

> **Development**
>
> -  Use any server-side language and template system.  
> -  Be productive by using the same code for static and dynamic
>    rendering.  


## Features

> **Script/Style Management**
>
> SPF can manage your script and style loading and unloading to
> ensure smooth updates when versions change during navigation.

<!-- -->

> **In-Memory Cache**
>
> SPF can store responses in memory for instant access.  This
> makes navigation to previous or future pages extremely fast.

<!-- -->

> **On-the-Fly Processing**
>
> SPF supports streaming multipart responses in chunks to enable
> on-the-fly processing.  This speeds up navigation by starting
> rendering early.



[Static Navigation]: assets/images/animation-static-340x178.gif
[Dynamic Navigation]: assets/images/animation-dynamic-340x178.gif
