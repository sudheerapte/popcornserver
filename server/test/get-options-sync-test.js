"use strict";

const [log, err] = require('./logerr.js');
const options = require('../get-options-sync.js');
const path = require('path');

console.log(JSON.stringify(options));


// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

