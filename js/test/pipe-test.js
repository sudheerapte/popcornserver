"use strict";

const [log, err] = require('./logerr.js');
const Pipe = require('../pipe.js');

function pipeTest() {
  return new Promise( (resolve, reject) => {
    let msg1 = "--- Test 1";
    log(msg1);
    const p = new Pipe();
    p.on('data', data => {
      data = data.toString();
      if(! data.startsWith('hello')) {
	reject(`data does not start with "hello"!`);
      }
    });
    p.on('error', errMsg => reject(errMsg) );
    p.end("hello world");
    resolve();
  });
}

pipeTest()
  .then(() => {
    log('done.');
    setImmediate( () => process.exit(0));
  })
  .catch((errMsg) => log(errMsg));

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});


