"use strict";

const [log, err] = require('./logerr.js');
const options = require('../get-options-sync.js');
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync("../options.json");
const obj = JSON.parse(content);

Object.keys(obj).forEach( k => {
  if (! options[k]) { err(`failed to find option ${k}`); }
  // If an option value contains a macro field, make sure
  // it is being substituted with something else.
  if (obj[k].indexOf("%D")!== -1 || obj[k].indexOf("%U") !== -1) {
    if (obj[k] === options[k]) {
      err(`Macro field was not substituted for option ${k}`);
    }
  }
});

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

