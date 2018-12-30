"use strict";

/*
  Resolves URL paths using files in an assets directory.

  Pass in a URL path and a writable stream to the method
  resolve(). The FileServer will write the contents of that file to
  the given stream, and also return the value of Content-Type to use.

  Example: if you create an instance of file-server like this:

   const fsmodule = require('./file-server.js');
   const fileServer = fsmodule('./assets');

  Then you can resolve a URL path like "/foo.jpg" as follows:

   ... obtain HTTP req and res streams ...

   const type = fileServer.resolve("/foo.jpg", res);

   This will return the string "image.jpg" and cause the contents of
   the file assets/foo.jpg to be written to the stream "res". When the
   file contents are completely written, the stream will automatically
   be ended. (This is usually what you want; if not, add a third
   boolean parameter to "resolve" with the value false. This has the
   same meaning as the Stream readable.pipe option named "end".)

  See "ContentType" object below to see the map of file extensions
  to the corresponding MIME Content-Type field.
*/

const fs = require('fs');
const path = require('path');

const ContentType = {
//  file extension to Content-Type
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

class FileServer {
  constructor(dirPath) {
    fs.readdirSync(dirPath);
    this._dirPath = dirPath;
  }

  /**
     @function(resolve) - extract the contents of the file and content type

     @arg(urlPath) - the path portion of the URL to resolve
     @arg(writeStream) - write the contents of the file to this stream
     @return(contentType) - a value for the HTTP "Content-Type" header.
   */

  resolve(urlPath, writeStream, end) {
    let p = path.normalize(path.join(this._dirPath, urlPath));
    const ext = path.extname(p);
    let contentType = "text/html";
    if (ContentType[ext]) {
      contentType = ContentType[ext];
    } else {
      console.log(`FileServer.resolve: ext ${ext} not found in ContentType`);
    }
    let str = fs.createReadStream(p);
    if (typeof end === 'undefined') { end = true; }
    str.pipe(writeStream, {end: end});
    return contentType;
  }
}

module.exports = FileServer;
