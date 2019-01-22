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

function unmaskedTest() {
  return new Promise( (resolve, reject) => {
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
      resolve();
    });
    let msg2 = "--- client says hello";
    log(msg2);
    c.sendMessage("hello", false, () => {
      log("hello sent");
    });
  });
}

unmaskedTest()
  .then(() => {
    maskedTest()
      .then(() => {
	payload16Test()
	  .then(() => {
	    setImmediate( () => process.exit(0));
	  });
      });
  })
  .catch((errMsg) => log(errMsg));

//---------------------------------

function maskedTest() {
  return new Promise( (resolve, reject) => {
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
      log(`client happy.`);
      resolve();
    });
    msg = "--- client says hello, masked";
    log(msg);
    c.sendMessage("hello", true, () => {
      log("hello sent");
    });
  });
}

// -------------------

function payload16Test() {
  return new Promise( (resolve, reject) => {
    let msg1 = "--- set up payload16Test";
    log(msg1);
    s2c = new Pipe(); c2s = new Pipe();
    s = new WebsocketEmitter(c2s, s2c);
    c = new WebsocketEmitter(s2c, c2s);

    s.on('message', message => {
      if (typeof message === 'string') {
	message = Buffer.from(message);
      }
      log(`server got msg length: |${message.length}|`);
      if (message.length !== 200) {
	err(`expecting 200 bytes, got ${message.length}`);
      }
      let msg3 = "--- server sending 300 bytes";
      log(msg3);
      s.sendMessage('y'.repeat(300), false, () => {
	log('300 bytes sent.');
      });
    });

    c.on('message', message => {
      if (typeof message === 'string') {
	message = Buffer.from(message);
      }
      log(`client got message of length: |${message.length}|.`);
      if (message.length !== 300) {
	err(`expecting 300 bytes, got ${message.length}`);
      }
      log(`test payload 16 successful.`);
      resolve();
    });
    let msg2 = "--- client sends 200 bytes, masked";
    log(msg2);
    c.sendMessage("x".repeat(200), true, () => {
      log("200 bytes sent");
    });
  });
}



// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

