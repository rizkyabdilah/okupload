## Synopsis

This is javascript client library that implement [tus](http://tus.io/) protocol in a modified version. This library
created as a proof of concept that resumable upload **big** file can be implemented and compatible
in almost every browser, even the one that didn't support HTML5. Included in this repository
server code example written in PHP, please see _upload.php_ for detailed information.

## Code Example

Script below is basic usage of the library.

```javascript
var opts = {
    endpoint: "/upload-url",
    uploadId: 0,
    browseButton: "pick-video",
    fail: function(msg){
        alert(msg);
    },
    progress: function(prc){
        console.log('Upload progress = ' + prc + '%');
    },
    done: function(e){
        alert("Done uploading");
    },
    runtime: "html5,flash",
    acceptedMimes: "video,image"
};
var uploader = new Uploader(opts);
```

## Motivation

This library is created on my last year project, through the time there are countless time
people ask my advice on _how to upload big file_ from browser/phone to the server, giving an
explanation is not easy task and when Im giving them link for referrence it seems
the library out there is either incomplete (not compatible with older browser)
or hard to implemented in customized environment.

```
Reading and implement RFC is easy task, but implement it right is hard thing to do
```

## Inspiration

This library is created based on and inspired by multiple project:

 * [tus.io](http://tus.io/)
 * [Resumable.js](http://www.resumablejs.com/)

## Limitation

While technically there is no limit in file size when uploading file, there is a limitation
when using flash as file reader (_non HTML5_), its either available RAM on the computer
or 200Mb, forgot the referrence, will add later.

## License

While I want this library released in MIT style, this library is included with mOxie library
for its XHR function. In the mean time I will check and figure out how this license work, and
if possible I will look a replacement for mOxie.
