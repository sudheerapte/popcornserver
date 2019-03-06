"use strict";

const [log, err] = require('./logerr.js');
const SendOneShot = require('../send-one-shot.js');
const fs = require('fs');

const FILENAME = '/tmp/send-one-shot-test.txt';

fs.writeFileSync(FILENAME,
                 `provide foo
.a
.b
`);


SendOneShot.doIt(FILENAME)
  .then( contents => {
    if (! contents.toString().includes('provide')) {
      err(`provide not found`);
    }
    log(`done`);
  })
  .catch( errMsg => err(errMsg) );

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

