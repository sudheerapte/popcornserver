"use strict";

const [log, err] = require('./logerr.js');
const SendOneShot = require('../send-one-shot.js');
const appServer = require('../app-server.js');
const fs = require('fs');
const net = require('net');

// We use an actual instance of appConnect to test send-one-shot.

const PORT=8001;
appServer.on('appConnect', () => log(`appServer appConnect emitted`) );
appServer.on('appDisconnect', () => log(`appServer appConnect emitted`) );
appServer.on('provide', () => log(`appServer provide emitted`) );
appServer.on('abandon', () => log(`appServer abandon emitted`) );

appServer.startListening({port: PORT})
  .then( () => {
    log(`started listening.`);
    return createSock();
  })
  .then( sock => sendStringTest(sock) )
  .then( () => {
    log(`success`);
    /* setImmediate( () => process.exit(0) ); */
  })
  .then( () => {
    appServer.stopListeningP()
      .then(()=> log(`stopListeningP resolved.`))
      .catch( errMsg );
  })
  .catch( err );

function createSock() {
  return new Promise( (resolve, reject) => {
    let success = false;
    setTimeout( () => {
      if (! success) { return reject(`timeout`); }
    }, 2000);
    log(`--- creating sock to appConnect`);
    const sock = net.createConnection({port:PORT}, () => {
      log(`sock created success`);
      success = true;
      resolve(sock);
    });
  });
}

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
addLeaf . a
addLeaf . b
`);
    return resolve(FILENAME);
  });
}

function sendStringTest(sock) {
  return new Promise( (resolve, reject) => {
    log(`--- sendString test`);
    createString()
      .then( cmd => SendOneShot.sendStringP(sock, cmd) )
      .then( reply => {
        if (! reply.toString().includes('ok')) {
          err(`ok not found`);
        } else {
          sock.end();
          resolve(`ok`);
        }
      })
      .catch( reject );
  });
}

function createString() {
  return new Promise( (resolve, reject) => {
    return resolve(`provide foo
addLeaf . a
addLeaf . b
`);
  });
}

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

