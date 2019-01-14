/**
   Copyright 2018,2019 Sudheer Apte
*/

"use strict";

/*
  @module(file-utils) - some filesystem utilities

  usage: const futils = require('./file-utils.js');

  futils.getCssList(machine) - returns a Promise whose "resolve" result
  is an array of relative pathnames of CSS files in that machine's dir.
  This output is used to populate <link> elements in index.html.

*/

const fs = require('fs');
const path = require('path');
const registry = require('./registry.js');

class FileUtils {
  // getSubdirs - return all subdirectories of toScan.
  // toScan is expressed relative to rootDir.
  getSubdirs(rootDir, toScan) {
    return new Promise((resolve, reject) => {
      fs.readdir(path.join(rootDir, toScan), (errMsg, arr) => {
	if (errMsg) {
          return reject(`getSubdirs: failed reading ${toScan}: ${errMsg}`);
	} else {
	  const subdirs = arr.filter( entry => {
            const ePath = path.join(rootDir, toScan, entry);
            const stat = fs.statSync(ePath);
            return stat.isDirectory();
          });
	  return resolve(subdirs);
	}
      });
    });
  }
  // expandDir - return all CSS files in toScan.
  // toScan is expressed relative to rootDir.
  getCss(rootDir, toScan) {
    return new Promise((resolve, reject) => {
      fs.readdir(path.join(rootDir, toScan), (errMsg, arr) => {
	if (errMsg) {
          return reject(`expandDir: failed reading ${toScan}: ${errMsg}`);
	} else {
	  const csslist = arr.filter( entry => {
            const ePath = path.join(rootDir, toScan, entry);
            const stat = fs.statSync(ePath);
            return !stat.isDirectory() && entry.match(/\.css$/);
          });
	  return resolve(csslist);
	}
      });
    });
  }
}

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO file-utils: ${str}`);
}

module.exports = new FileUtils();
