---
title: Get Started
description: Start here.  Learn how to check out and build SPF for the first time.
---

## Test out the demo

To get started, first **[download the project][download]**.

Next, build the included demo application to see how everything works together
and test out the framework:

```sh
$ cd spfjs
$ make demo
```

Running `make` will download the needed packages and compile the code.

> **Note:** You will need Python and Java installed.

You can then open <http://localhost:8080/> in your browser and check out the demo.


## Add SPF to your site

To add SPF to your site, build the main SPF JS file, and copy it to where
you serve JS files for your site:

```sh
$ make
$ cp build/spf.js YOUR_JS_DIR/
```

Then, add the script to your page and initialize SPF:

```html
<script src="YOUR_JS_DIR/spf.js"></script>
<script>
  spf.init();
</script>
```


[download]: ../../download/
