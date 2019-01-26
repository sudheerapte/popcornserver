"use strict";

/**
   @module(debug-log) - return a log() function for a given __filename

   Usage: let log = require('./debug-log.js')(__filename);

   Returns either a do-nothing logging function, or a printing
   logging function, depending on the value of process.env["DEBUG"].
 */
function logNone() {}
let log = logNone;
let fil = "nofile";

function createLog(filename) {
  if (process.env["DEBUG"]) {
    fil = require('path').basename(filename, ".js");
    const index = process.env["DEBUG"].indexOf(fil);
    if (index >= 0) {
      console.log(`[debugging ${fil}.js]`);
      log = logPrint;
    }
  }
  return log;
}

function logPrint(str) {
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO ${fil}: ${str}`);
}

module.exports = createLog;

