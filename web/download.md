---
title: Download
description: Get the code.
layout: download
---

The most recent release is **{{ site.release }}**.

You can get the code in several ways:


## Download a release

Download just the minified JS files:
**[spfjs-{{ site.version }}-dist.zip](https://github.com/youtube/spfjs/releases/download/v{{ site.version }}/spfjs-{{ site.version }}-dist.zip)**

```sh
$ curl -LO https://github.com/youtube/spfjs/releases/download/v{{ site.version }}/spfjs-{{ site.version }}-dist.zip
$ unzip spfjs-{{ site.version }}-dist.zip
```

Or, download the minified files and complete source code:
**[v{{ site.version }}.zip](https://github.com/youtube/spfjs/archive/v{{ site.version }}.zip)**

```sh
$ curl -LO https://github.com/youtube/spfjs/archive/v{{ site.version }}.zip
$ unzip v{{ site.version }}.zip
```


## Clone with Git

Clone the project from GitHub and checkout the release:

```sh
$ git clone https://github.com/youtube/spfjs.git
$ cd spfjs
$ git checkout v{{ site.version }}
```


## Install with npm

Install the npm package:

```sh
$ npm install spf
```


## Install with Bower

Install the Bower package:

```sh
$ bower install spf
```


## Get Started

After you've grabbed the code, **[get started][start]**.


[start]: ../documentation/start/
