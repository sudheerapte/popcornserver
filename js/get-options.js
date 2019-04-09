"use strict";

/**
   Reads a file named "options.json" in the popcorn config directory,
   and returns the resulting object. This module returns an object
   whose get() method returns a Promise evaluating to the
   options object.

   Names and values in the options object are strings.

   Path values are macro-substituted as follows:

   %D   the directory where this file lives, i.e., __dirname
   %U   the user's home directory, a.k.a. "~"

*/

const fs = require('fs');
const path = require('path');

function populateOptions() {

  return new Promise( (resolve, reject) => {
    let options = {};
    let optPath = getPopcornConfigPath();

    if (! optPath) {
      return reject(`popcorn config dir ~/.popcorn not found`);
    }
    log(`optPath = ${optPath}`);
    setImmediate( () => {
      const contents = fs.readFileSync(optPath);
      try {
        options = JSON.parse(contents);
      } catch(e) {
        console.log(`*** bad contents in options file ${optPath}`);
      }
      swizzlePaths(options); // Macro replace machine dir paths.
      return resolve(options);
    });
  });
}

// populateOptions  is returned as a member of module.exports

// ----------------- only functions below this point -------

function homedir() {
  return (process.env["HOME"]) ?
    process.env["HOME"] :
    "/";
}
  
function getPopcornConfigPath() { // return path or null
  const LOC = path.join(".popcorn", "options.json");
  let filePath;
  const home = process.env["HOME"];
  filePath = path.join(home, LOC);
  try {
    const stats = fs.statSync(filePath);
  } catch(e) {
    log(`failed to read ${filePath}: ${e.code}`);
    return null;
  }
  return filePath;
}

function swizzlePaths(options) {
  if (! options.machineDirs) {
    return;
  }
  const machineObj = options.machineDirs;
  Object.keys(machineObj).forEach( k => {
    let temp = machineObj[k];
    temp = temp.replace(/\%D/, __dirname);
    temp = temp.replace(/\%U/, homedir());
    temp = temp.replace(/\~/, homedir());
    machineObj[k] = temp;
  });
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('get-options', logger);
function log(str) { logger.log(str); }

module.exports = {
  get: populateOptions
};
