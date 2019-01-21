"use strict";

const [log, err] = require('./logerr.js');
const WebsocketEmitter = require('../websocket-emitter.js');
const path = require('path');
const { Duplex } = require('stream');

/*
    s --> s2c --> c
    s <-- c2s <-- c
*/
let s, c, s2c, c2s;

class Pipe extends Duplex {
  constructor(options) {
    super(options);
  }
  _write(chunk, encoding, callback) {
    if (Buffer.isBuffer(chunk)) {
      this.buf = chunk;
      this._data_available = true;
    }
  }

  _read(size) {
    this.waitForBuf( () => this.push(this.buf) );
  }
  waitForBuf( cb ) {
    if (this._data_available) {
      this._data_available = false;
      return cb();
    } else {
      setTimeout( () => this.waitForBuf(cb), 200 );
    }
  }
}


function startHelloUnmasked() {
  let msg2 = "--- client says hello";
  log(msg2);
  c.sendMessage("hello", false, () => {
    log("hello sent");
  });
}

function setupUnmasked(cb) {
  let msg1 = "--- set up two duplex streams between server and client";
  log(msg1);
  s2c = new Pipe(); c2s = new Pipe();
  s = new WebsocketEmitter(c2s, s2c);
  c = new WebsocketEmitter(s2c, c2s);

  s.on('message', message => {
    log(`server got: |${message.toString()}|`);
    if (message.toString() !== 'hello') {
      err(`expecting hello, got ${message.toString()}`);
    }
    let msg3 = "--- server sending how are you";
    log(msg3);
    s.sendMessage('how are you', false, () => {
      log('how are you sent.');
    });
  });

  c.on('message', message => {
    log(`client got: |${new Buffer(message)}|.`);
    if (message !== 'how are you') {
      err(`expecting how are you, got ${message}`);
    }
    log(`test unmasked successful.`);
    cb();
  });
}

setupUnmasked( () => {
  setupHelloMasked();
  startHelloMasked();
});

startHelloUnmasked();


//---------------------------------

function startHelloMasked() {
  let msg = "--- client says hello, masked";
  log(msg);
  c.sendMessage("hello", true, () => {
    log("hello sent");
  });
}

function setupHelloMasked() {
  let msg = "--- set up two duplex streams between server and client";
  log(msg);
  s2c = new Pipe(); c2s = new Pipe();
  s = new WebsocketEmitter(c2s, s2c);
  c = new WebsocketEmitter(s2c, c2s);

  s.on('message', message => {
    log(`server got: |${message.toString()}|`);
    if (message.toString() !== 'hello') {
      err(`expecting hello, got ${message.toString()}`);
    }
    let msg3 = "--- server sending how are you";
    log(msg3);
    s.sendMessage('how are you', false, () => {
      log('how are you sent.');
    });
  });

  c.on('message', message => {
    log(`client got: |${new Buffer(message)}|.`);
    if (message !== 'how are you') {
      err(`expecting how are you, got ${message}`);
    }
    log(`client exiting.`);
    setImmediate( () => process.exit(0) );
  });
}

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

