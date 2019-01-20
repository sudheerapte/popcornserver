"use strict";

/**
   Reads a file named "options.json" in the popcorn config directory,
   and returns the resulting object.

   If the popcorn config directory does not exist, we fall back to
   using the "options.json" in the current directory (where this
   source file exists).

   Names and values in the options object are strings.

   Path values are macro-substituted as follows:

   %D   the directory where this file lives, i.e., __dirname
   %U   the user's home directory

*/

const fs = require('fs');
const path = require('path');

let optPath = getPopcornConfigPath() ||
    path.join(dirname(), "options.json");
// The following line will crash node if it fails. Good.
const contents = fs.readFileSync(optPath);
let options = {};
try {
  options = JSON.parse(contents);
} catch(e) {
  console.log(`*** bad contents in options file ${optPath}`);
}

// Macro replace machine dir paths.
swizzlePaths();

// options object is returned as the module.exports value

// ----------------- only functions below this point -------

function dirname() { return `${__dirname}`;}
function homedir() { return process.env["HOME"]; }

function getPopcornConfigPath() { // return path or null
  const LOC = path.join(".popcorn", "options.json");
  let filePath;
  const home = process.env["HOME"];
  if (home) {
    filePath = path.join(home, LOC);
    try {
      const stats = fs.statSync(filePath);
    } catch(e) {
      log(`failed to read ~/${LOC}: ${e.code}`);
      log(`falling back to ${__dirname}`);
      return null;
    }
  } else {
    console.log(`no HOME directory!`);
    console.log(`falling back to ${__dirname}`);
    return null;
  }
  return filePath;
}

function swizzlePaths() {
  if (! options.machineDirs) {
    options.machineDirs = {"demo": "%D/demo"};
  }
  const machineObj = options.machineDirs;
  Object.keys(machineObj).forEach( k => {
    let temp = machineObj[k];
    temp = temp.replace(/\%D/, dirname());
    temp = temp.replace(/\%U/, homedir());
    machineObj[k] = temp;
  });
}

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO http-server: ${str}`);
}

module.exports = options;
