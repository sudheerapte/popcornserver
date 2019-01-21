"use strict";

const [log, err] = require('./logerr.js');
const WebsocketEmitter = require('../websocket-emitter.js');
const path = require('path');
const { Duplex } = require('stream');

let msg1 = "--- set up two duplex streams between server and client";
log(msg1);
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

s2c = new Pipe(); c2s = new Pipe();
s = new WebsocketEmitter(c2s, s2c);
c = new WebsocketEmitter(s2c, c2s);

s.on('message', message => {
  console.log(`server got: |${message.toString()}|`);
  let msg3 = "--- server sending how are you";
  log(msg3);
  s.sendMessage('how are you', false, () => {
    log('how are you sent.');
  });
});

c.on('message', message => {
  console.log(`client got: |${new Buffer(message)}|`);
});

let msg2 = "--- client says hello";
log(msg2);
c.sendMessage("hello", false, () => {
  log("hello sent");
});

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

