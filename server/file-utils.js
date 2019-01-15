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
const EventEmitter = require('events');

/**
   @class(DirTraverser) - traverse a directory recursively

   Pass in a directory path to the constructor. Immediately
   emits a "discover" event with this directory. After the entire
   traversal is done, it emits a final event "done" with this
   directory path as argument.

   Events:
    discover DIR - discovered a new directory DIR
    done DIR - done traversing directory DIR
*/

class DirTraverser extends EventEmitter {
  constructor(dir) {
    super();
    this.traverse(dir);
  }
  traverse(dir, cb) { // cb(err)
    fs.readdir(dir, (errMsg, arr) => {
      if (errMsg) {
	this.emit('error', `${errMsg}`);
	return cb(errMsg);
      } else {
	const subdirs = arr.filter( entry => {
          const stat = fs.statSync(path.join(dir, entry));
          return stat.isDirectory();
        });
	subdirs.forEach( s => {
	  this.emit('discover', path.join(dir, s));
	  this.traverse(path.join(dir, s));
	});
	this.emit('done', dir);
      }
    });
  }
}

class FileUtils {
  // getAllSubdirs - return an array of all subdirs, recursively
  // returns a Promise that resolves to an array of paths
  getAllSubdirs(dir) {
    let arr = [];
    return new Promise( (resolve, reject) => {
      let stack = 1; // number of dirs discovered but not done
      let trav = new DirTraverser(dir);
      trav.on('error', msg => reject(msg));
      trav.on('discover', aDir => {
	stack++;
	// console.log(' '.repeat(stack*2) + `[${aDir}`);
	arr.push(aDir);
      });
      trav.on('done', aDir => {
	stack--;
	// console.log(' '.repeat(stack*2) + `]`);
	if (stack <= 0) { resolve(arr); }
      });
    });
  }

  // getCss - return all CSS files in toScan.
  // toScan is expressed relative to rootDir.
  getCss(rootDir, toScan) {
    return new Promise((resolve, reject) => {
      let arr = [];

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
