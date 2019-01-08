"use strict";

const http = require('http');
const [log, err] = require('./logerr.js');
const {Writable} = require('stream');
const hsmodule = require('../http-server.js');

const PORT = 8000;

let msg, options, httpServer, httpRequest, numBytes;

httpServer = new hsmodule(PORT);
httpServer || err(msg);

// -----------------

function test1() {
  return new Promise(resolve => {
    msg = "1. get index.html";
    log(msg);
    numBytes = 0;
    options = {port: PORT, method: 'GET', path: '/'};
    httpRequest = http.request(options, res => {
      res.on('data', chunk => {
	numBytes += chunk.length;
	log(`|${chunk}|`);
      });
      res.on('end', () => {
	log('test1 res ended.');
	let test1Done = true;
	return resolve(test1Done);
      });
    });
    httpRequest.on('error', errMsg => err(errMsg));
    httpRequest.end();
    log('http-server-test: request ended.');
  });
}

// -----------------
function test2() {
  return new Promise(resolve => {
    msg = "2. try bad URL /foo";
    log(msg);
    numBytes = 0;
    options = {port: PORT, method: 'GET', path: '/foo'};
    httpRequest = http.request(options, res => {
      res.on('data', chunk => {
	if (chunk.toString().match(/no\ such\ path/)) {
	  log('test2: found No such path error, as expected');
	  let test2Done = true;
	  return resolve(test2Done);
	} else {
	  err(`expecting No such path; found |${chunk}|`);
	}
      });
      res.on('end', () => {
	log('test2 res ended.');
      });
    });
    httpRequest.on('error', errMsg => err(errMsg));
    httpRequest.end();
  });
}

function endOfTest() {
  log(`test successful: received ${numBytes} bytes`);
  process.exit(0);
}

test1().then(() => test2()).then(() => endOfTest());

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    if (! test1Done) { err("test1Done"); }
    if (! test2Done) { err("test2Done"); }
  }
});

