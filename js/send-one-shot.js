"use strict";

const fs = require('fs');
const net = require('net');
const SSE = require('./sse.js');

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

function getPopcornSocketP() {
  return new Promise( (resolve, reject) => {
    let options = {host: "localhost", port: "8001"};
    if (process.env["POPCORNHOST"]) {
      options.host = process.env["POPCORNHOST"];
    }
    if (process.env["POPCORNPORT"]) {
      options.port = process.env["POPCORNPORT"];
    }
    let success = false;
    setTimeout( () => {
      if (! success) { return reject(`timeout`); }
    }, 2000);
    log(`--- connecting to ${JSON.stringify(options)}`);
    const sock = net.createConnection(options, () => {
      log(`sock created success`);
      success = true;
      resolve(sock);
    });
  });
}

function sendStringP(sock, cmd) {
  return new Promise( (resolve, reject) => {
    const sse = new SSE;
    sse.readFrom(sock);
    sse.setWriteStream(sock);
    sse.on('SSEvent', ev => {
      if (ev.type === 'replySuccess') {
        return resolve(ev.data);
      } else {
        return reject(ev.data);
      }
    });
    sse.sendEvent({ type: "oneShotCommand", data: cmd });
  });
}

module.exports = {
  sendStringP: sendStringP,
  getPopcornSocketP: getPopcornSocketP,
};
