"use strict";

const [log, err] = require('./logerr.js');
const GetOptions = require('../get-options.js');
const fs = require('fs');
const path = require('path');

GetOptions.get()
  .then(options => {
    log(`options = ${JSON.stringify(options)}`);
    const machineDirs = options.machineDirs;
    machineDirs || err(`machineDirs is null!`);
    Object.keys(machineDirs).forEach( k => {
      if (! machineDirs[k]) { err(`failed to find option ${k}`); }
      // If an option value contains a macro field, make sure
      // it is being substituted with something else.
      if (machineDirs[k].indexOf("%D")!== -1 ||
          machineDirs[k].indexOf("%U") !== -1) {
        if (machineDirs[k] === options.machineDirs[k]) {
          err(`Macro field was not substituted for option ${k}`);
        }
      }
    });
  })
  .catch( errMsg => console.log(errMsg) );

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

