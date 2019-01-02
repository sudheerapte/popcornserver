"use strict";

/*
  Resolves URL paths using files in an assets directory.

  Instantiate a FileServer instance with a directory path.

  Pass in a URL path and a writable stream to the method
  resolve(). The FileServer will write the contents of that file to
  the given stream, and also return the value of Content-Type to use.
  The passed-in URL path must begin with "/". The rest of this path
  will be looked up under the assets directory.

  Example: if you create an instance of file-server like this:

   const fsmodule = require('./file-server.js');
   const fileServer = fsmodule('./assets');

  Then you can resolve a URL path like "/foo.jpg" as follows:

   ... obtain HTTP req and res streams ...

   const type = fileServer.resolve("/foo.jpg", res, () => {});

   This will return the string "image/jpeg" and cause the contents of
   the file assets/foo.jpg to be written to the stream "res". When the
   file contents are completely read, the callback will be called, with
   an error argument if there was any error.

   Possible errors:

     ENOENT - no such file.
     No ContentType for extension '${ext}' - bad file extension.
     Stream error - failed to properly read data from file.

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
     @arg(cb) - callback func when done; arg = null or error message.
     @return(contentType) - a value for the HTTP "Content-Type" header.
   */

  resolve(urlPath, writeStream, cb) {
    let p = path.normalize(path.join(this._dirPath, urlPath));
    const ext = path.extname(p);
    let contentType = "text/html";
    if (ContentType[ext]) {
      contentType = ContentType[ext];
    } else {
      cb(`No ContentType for extension '${ext}'`);
    }
    fs.access(p, fs.constants.R_OK, eMsg => {
      if (eMsg) {
	cb(eMsg.code);
      } else {
	let str = fs.createReadStream(p);
	str.pipe(writeStream, {end: false});
	str.on('end', () => cb(null));
	str.on('error', msg => cb(msg));
      }
    });
    return contentType;
  }
}

module.exports = FileServer;
