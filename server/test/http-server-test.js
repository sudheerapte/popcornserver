"use strict";

const http = require('http');
const [log, err] = require('./logerr.js');
const {Writable} = require('stream');
const hsmodule = require('../http-server.js');

const PORT = 8000;

let msg;

// -----------------
msg = "1. create http-server and open connection";
log(msg);
let numBytes = 0; // length of page served
const httpServer = new hsmodule(PORT);
httpServer || err(msg);
const httpRequest = http.request({port: PORT, method: 'GET'}, res => {
  // log('httpRequest: got response.');
  // log(`STATUS: ${res.statusCode}`);
  // log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.on('data', chunk => numBytes += chunk.length );
  res.on('end', () => {
    let httpRequestDone = true;
    endOfTest();
  });
});

httpRequest.on('error', errMsg => err(errMsg));
httpRequest.end();

function endOfTest() {
  log(`test successful: received ${numBytes} bytes`);
  process.exit(0);
}

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    if (! httpRequestDone) { err("httpRequestDone"); }
  }
});

