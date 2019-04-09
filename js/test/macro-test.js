"use strict";

const [log, err] = require('./logerr.js');
const macro = require('../macro.js');

// expandOneLevel

const cases = [
  // text                                           length of result
  { t: "one {macro} two",                                 e: 3 },
  { t: "some text with a {macro} and an ending {macro}",  e: 5 },
  { t: "{macro} at beginning and an ending {macro}",      e: 5 },
  { t: "no macros",                                       e: 1 },
  { t: "",                                                e: 1 },
  { t: "with {nested {macros {macros}} }",                e: 3 },
];  

cases.forEach( (rec, i) => {
  log(`Expanding: |${rec.t}|`);
  const arr = [];
  macro.expandOneLevel(arr, rec.t);
  log(arr);
  if (rec.e !== arr.length) {
    err(`expected ${rec.e} tokens, got ${arr.length}`);
  }
});

// expandOneLevel


// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

