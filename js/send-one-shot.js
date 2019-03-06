"use strict";

const fs = require('fs');
const net = require('net');
const GetOptions = require('./get-options.js');

/**
   @module(send-one-shot) - send a one-shot command to Popcorn

   You can either give it a string contents to be sent,
   or the name of a file to be opened; the file's contents will be sent.

   Usage:

   Directly passing the command string:

     const S = require('./send-one-shot.js');
     S.open()
       .then( () => S.doIt(`P .a\nP .b`) )
       .then( ok => console.log('ok') )
       .catch( errMsg => console.log(errMsg) );

   Or, with a file:

     const S = require('./send-one-shot.js');
     S.doIt('/tmp/command.txt');
       .then( ok => console.log('ok') )
       .catch( errMsg => console.log(errMsg) );

*/

// create logging function log(str). Copy and paste these lines.
const logger = {};
function log(str) { logger.log(str); }
require('./debug-log.js')
  .registerLogger('send-one-shot', logger);

let appPort = null; // will be read from options.json and kept around 

function doIt(filename) {
  return new Promise( (resolve, reject) => {
    slurpCommand(filename)
      .then( cmd => resolve(cmd) )
    /*
      .then( GetOptions.get )
      .then( pOptions => {
      // log(`pOptions = ${JSON.stringify(pOptions)}`);
      const options = {host: "localhost", port: pOptions.appPort};
      // log(`options = ${JSON.stringify(options)}`);
      const sock = net.createConnection(options, () => {
      sendArr(sock, ["data: provide foo", "data: P .a", "data: P .b"])
      .then( () => log(`done`) )
      .catch( errMsg => log(errMsg) );
      });
      })
    */
      .catch( errMsg => {
        return reject(errMsg);
      });
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

module.exports = {
  open: open,
  slurpCommand: slurpCommand,
  doIt: doIt,
  sendArr: sendArr,
};
