"use strict";

/**
   @function(expandOneLevel) - chop up text into deepest macros

   Returns an array of strings as follows:

   prefix1, macro1, suffix1, macro2, suffix2, ..., macroN, suffixN

   The "prefix1" will always be present; it might be zero-length if
   the first macro starts at the beginning of the text.

   "suffixN" will always be present for each macroN, even if it
   is zero-length in the case where macroN is at the end of text or
   where macro(N+1) is immediately after macroN.

*/

function expandOneLevel(result, text) { // result starts with empty array
  let pair;;
  do {
    pair = biteOne(text);
    if (pair) {
      result.push(text.substring(0, pair[0]));
      result.push(text.substring(pair[0], pair[1]));
      text = text.substring(pair[1]);
    }
  } while (pair);
  result.push(text);
}  

function biteOne(text) { // returns null or [ start, end ]
  const re = /\{([^{}]+)\}/;
  if (! text) { return null; }
  const m = text.match(re);
  if (m) {
    return [ m.index, m.index+m[0].length ];
  } else {
    return null;
  }
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('macro', logger);
function log(str) { logger.log(str); }

module.exports = {
  expandOneLevel: expandOneLevel,
}
