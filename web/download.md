---
title: Download
description: Get the code.
layout: download
---


## Install with npm or Bower

Install the [npm][] package:

```sh
npm install spf
```

Install the [Bower][] package:

```sh
bower install spf
```


## Link to a CDN

You can link to the JS files directly from several popular CDNs:

- [Google Hosted Libraries][]  
  `https://ajax.googleapis.com/ajax/libs/spf/{{ site.version }}/spf.js`
- [cdnjs][]  
  `https://cdnjs.cloudflare.com/ajax/libs/spf/{{ site.version }}/spf.js`
- [jsDelivr][]  
  `https://cdn.jsdelivr.net/spf/{{ site.version }}/spf.js`
- [OSSCDN][]  
  `https://oss.maxcdn.com/spf/{{ site.version }}/spf.js`


## Download a release

Download just the minified JS files:
**[spfjs-{{ site.version }}-dist.zip][]**

```sh
curl -LO https://github.com/youtube/spfjs/releases/download/v{{ site.version }}/spfjs-{{ site.version }}-dist.zip
unzip spfjs-{{ site.version }}-dist.zip
```

Or, download the minified files and complete source code:
**[v{{ site.version }}.zip][]**

```sh
curl -LO https://github.com/youtube/spfjs/archive/v{{ site.version }}.zip
unzip v{{ site.version }}.zip
```


## Clone with Git

Clone the project from GitHub and checkout the release:

```sh
git clone https://github.com/youtube/spfjs.git
cd spfjs
git checkout v{{ site.version }}
```


## Get Started

After you've grabbed the code, **[get started][]**.



[get started]: ../documentation/start/
[npm]: https://www.npmjs.com/
[Bower]: http://bower.io/
[Google Hosted Libraries]: https://developers.google.com/speed/libraries/devguide#spf
[cdnjs]: https://cdnjs.com/libraries/spf
[jsDelivr]: http://www.jsdelivr.com/#!spf
[OSSCDN]: http://osscdn.com/#/spf
[spfjs-{{ site.version }}-dist.zip]: https://github.com/youtube/spfjs/releases/download/v{{ site.version }}/spfjs-{{ site.version }}-dist.zip
[v{{ site.version }}.zip]: https://github.com/youtube/spfjs/archive/v{{ site.version }}.zip
