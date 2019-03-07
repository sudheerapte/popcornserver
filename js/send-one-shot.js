"use strict";

const fs = require('fs');
const net = require('net');
const GetOptions = require('./get-options.js');

/**
   @module(send-one-shot) - send a one-shot command to Popcorn

   You can either give it a string contents to be sent,
   or the name of a file to be opened; the file's contents will be sent.

   Usage:

   See test/send-one-shot-test.js
*/

// create logging function log(str). Copy and paste these lines.
const logger = {};
function log(str) { logger.log(str); }
require('./debug-log.js')
  .registerLogger('send-one-shot', logger);

let appPort = null; // will be read from options.json and kept around 

function sendFileP(filename) {
  return new Promise( (resolve, reject) => {
    let theOptions;
    GetOptions.get()
      .then(options => {
        theOptions = theOptions;
        return slurpCommand(filename);
      })
      .then( cmdString => {
        const options = {host: "localhost", port: theOptions.appPort};
        const sock = net.createConnection(options, () => {
          const arr = cmdString.split('\n');
          sendArr(sock, arr);
        });
      })
      .catch( reject );
  });
}

function slurpCommand(filename) {
  return new Promise( (resolve, reject) => {
    if (typeof filename === 'string') {
      log(`reading from file ${filename}`);
      try {
        const contents = fs.readFileSync(filename);
        const arr = contents.toString().split('\n');
        return resolve(arr);
      } catch( e ) {
        return reject(e.message);
      }
    } else { // must be string
      const arr = filename.split('\n');
      return resolve(arr);
    }
  });
}

function sendArr(arr) {
  return new Promise( (resolve, reject) => {
    let done = false;
    sock.on('error', errMsg => {
      done = true;
      return reject(errMsg);
    });
    sock.on('end', () => {
      if (done) { return; }
      log(`got dropped.`);
      done = true;
      sock.end();
      return resolve();
    });
    sock.on('data', data => {
      data = data.toString();
      if (data && data.includes(' replySuccess')) {
        done = true;
        return resolve();
      } else {
        done = true;
        const replyArr = data.split(/\r\n|\n/);
        const msg = (replyArr.length < 2) ? "data: (replyError)" : replyArr[1];
        return reject(msg.slice(6)); // remove "data: "
      }
    });
    const firstCommand = `event: oneShotCommand` +
          arr.join('\n') + '\n\n';
    log(`sending first command: |${arr.join(", ")}|`);
    sock.write(firstCommand);
  });
}

function open() {
  return new Promise( (resolve, reject) => {
    GetOptions.get()
      .then( options => {
        if (options.appPort) {
          appPort = options.appPort;
          return resolve(options.appPort);
        } else {
          return reject(`no application port!`);
        }
      })
      .catch( reject );
  });
}

function sendStringP() {}

module.exports = {
  sendFileP: sendFileP,
  sendStringP: sendStringP,
};
