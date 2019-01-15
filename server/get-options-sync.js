"use strict";

/**
   Reads a file named "options.json" in the current directory,
   and returns the resulting object.

   The path to options.json can be overridden by setting the environment
   variable POPCORN_OPTIONS.

   Names and values in the options object are strings.

   In the values, the following substitutions have been made:

   %D   the directory where this file lives, i.e., __dirname
   %U   the user's home directory

*/

const fs = require('fs');
const path = require('path');

let optPath = dirname();
if (process.env["POPCORN_OPTIONS"]) {
  optPath = process.env["POPCORN_OPTIONS"];
  if (optPath.endsWith("options.json")) {
    optPath = optPath.substr(0, optPath.length - 12);
  }
}
// The following line will crash node if it fails. Good.
let contents = fs.readFileSync(path.join(optPath, "options.json"));
let options = {};
try {
  options = JSON.parse(contents);
} catch(e) {
  console.log(`*** bad contents in options file ${path.join(optPath, "options.json")}`);
}

Object.keys(options).forEach( k => {
  let temp = options[k];
  temp = temp.replace(/\%D/, dirname());
  temp = temp.replace(/\%U/, homedir());
  options[k] = temp;
});
function dirname() { return `${__dirname}`;}
function homedir() { return process.env["HOME"]; }
module.exports = options;
