/**
   Copyright 2018,2019 Sudheer Apte
*/

"use strict";

/*
  @module(file-utils) - some filesystem utilities

  usage: const futils = require('./file-utils.js');

  futils.getCss(machine) - returns a Promise whose "resolve" result
  is an array of relative pathnames of CSS files in that machine's dir.
  This output is used to populate <link> elements in index.html.

*/

const fs = require('fs');
const path = require('path');
const registry = require('./registry.js');
const EventEmitter = require('events');


class FileUtils {
  streamFile(filePath, outStream, cb) { // cb(errMsg)
    fs.access(filePath, fs.constants.R_OK, eMsg => {
      if (eMsg) {
	cb(eMsg);
      } else {
	let str = fs.createReadStream(filePath);
	str.on('data', chunk => {
	  outStream.write(chunk);
	});
	str.on('end', () => {
	  cb(null);
	});
	str.on('error', msg => {
	  cb(msg);
	});
      }
    });
  }

  streamFP(filePath, outStream) { // returns a Promise
    return new Promise( (resolve, reject) => {
      this.streamFile(filePath, outStream, eMsg => {
        if (eMsg) {
          return reject(eMsg);
        } else {
          return resolve();
        }
      });
    });
    log(`streamFP(${filePath}): returned a Promise`);
  }

  // streamJsModuleFP: resolves the name to a file under this file's
  // directory, and automatically sets up a "module" variable so that
  // the "export" in the module has no effect.
  streamJsModuleFP(fileName, outStream) { // returns a Promise
    const filePath = path.join(__dirname, fileName);
    return new Promise( (resolve, reject) => {
      outStream.write('\nmodule = {};\n');
      this.streamFile(filePath, outStream, eMsg => {
        if (eMsg) {
          return reject(eMsg);
        } else {
          return resolve();
        }
      });
    });
    log(`streamJsModuleFP(${filePath}): returned a Promise`);
  }
}

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO file-utils: ${str}`);
}

module.exports = new FileUtils();
