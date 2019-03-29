"use strict";

/**
   @function(expandOneLevel) - chop up text into deepest macros

   Returns an array of tokens as follows:

   T, M1, T1, M2, T2,..., MN, TN

   The "T" tokens are text, and the "M" tokens are macros.

   The "T" will always be present; it might be zero-length if
   the first macro starts at the beginning of the text. Thus, if you
   pass in text that does not contain any macros, you will get just
   one "T" token.

   Each token has a corresponding text value. It might be an empty
   string.

*/

function expandOneLevel(result, text) { // call with empty array result
  let pair;
  do {
    pair = biteOne(text);
    if (pair) {
      result.push({ tok: "T", txt: text.substring(0, pair[0]) });
      result.push({ tok: "M", txt: text.substring(pair[0], pair[1]) });
      text = text.substring(pair[1]);
    }
  } while (pair);
  result.push({tok: "T", txt: text});
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
