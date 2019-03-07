"use strict";

const [log, err] = require('./logerr.js');
const SendOneShot = require('../send-one-shot.js');
const fs = require('fs');

sendFileTest();

function sendFileTest() {
  return new Promise( (resolve, reject) => {
    log(`--- sendFile test`);
    createTempFile()
      .then( SendOneShot.sendFile ) // takes filename argument
      .then( contents => {
        if (! contents.toString().includes('provide')) {
          err(`provide not found`);
        }
        log(`done`);
      })
      .catch( reject );
  });
}

function createTempFile() {
  return new Promise( (resolve, reject) => {
    const FILENAME = '/tmp/send-one-shot-test.txt';
    fs.writeFileSync(FILENAME,
                     `provide foo
.a
.b
`);
    return resolve(FILENAME);
  });
}

function sendStringTest() {
  return new Promise( (resolve, reject) => {
    log(`--- sendString test`);
    createString()
      .then( SendOneShot.sendString ) // takes filename argument
      .then( contents => {
        if (! contents.toString().includes('provide')) {
          err(`provide not found`);
        }
        log(`done`);
      })
      .catch( reject );
  });
}

function createString() {
  return new Promise( (resolve, reject) => {
    return (`provide foo
.a
.b
`);
  });
}


// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

