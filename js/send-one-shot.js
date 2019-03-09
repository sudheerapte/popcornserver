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

function sendArrP(sock, arr) {
  return new Promise( (resolve, reject) => {
    let done = false;
    sock.on('error', errMsg => {
      log(`sock got error`);
      done = true;
      return reject(errMsg);
    });
    sock.on('end', () => {
      log(`sock got end; done = ${done}`);
      if (done) {
        return;
      } else {
        log(`got dropped. Ending my side`);
        done = true;
        sock.end();
        return resolve("(no reply)");
      }
    });
    sock.on('data', data => {
      log(`sock got data`);
      data = data.toString();
      if (data && data.includes(' replySuccess')) {
        const cdr = extractCdr(data);
        log(`cdr = |${cdr}|`);
        return resolve(cdr);
      } else {
        done = true;
        return reject(extractCdr(data));
      }
    });
    const cdr = arr.map(line => 'data: ' + line);
    const firstCommand = `event: oneShotCommand\n` +
          cdr.join('\n') + '\n\n';
    // log(`sending first command: |${firstCommand}|`);
    sock.write(firstCommand);
  });
}

function extractCdr(msg) {
  const replyArr = msg.split(/\r\n|\n/);
  if (replyArr.length <=1) {
    return "";
  } else {
    const extractArr =  replyArr.filter(line => line.match(/^data:\s/) );
    return extractArr.map( line => line.slice(6) ).join('\n');
  }
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

function sendStringP(sock, cmd) {
  return new Promise( (resolve, reject) => {
    const arr = cmd.split('\n');
    sendArrP(sock, arr)
      .then( resolve )
      .catch( reject);
  });
}

module.exports = {
  sendStringP: sendStringP,
  sendArrP: sendArrP,
  sendFileP: sendFileP,
};
