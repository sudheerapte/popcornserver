"use strict";

const [log, err] = require('./logerr.js');
const DebugLog = require('../debug-log.js');
const { Duplex } = require('stream');

// class Pipe - you can read whatever you write on the other end
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

function l1Test() {
  return new Promise( (resolve, reject) => {
    const l1 = {};
    DebugLog.registerLogger("l1", l1);
    let msg1 = "--- test 1";
    log(msg1);
    let p = new Pipe();
    DebugLog.setOut(p);
    DebugLog.startDebugging('l1');
    p.on('data', data => {
      const d = data.toString();
      const result = d.includes('this is l1');
      if (! result) {
	err(`no message "this is l1" recieved!`);
      }
      p.end();
      resolve();
    });
    p.on('error', errMsg => err(errMsg) );
    l1.log('this is l1');
  });
}

function l1l2Test() {
  return new Promise( (resolve, reject) => {
    const l1 = {};
    DebugLog.registerLogger("l1", l1);
    const l2 = {};
    DebugLog.registerLogger("l2", l2);
    let msg1 = "--- test 2";
    log(msg1);
    let p = new Pipe();
    DebugLog.setOut(p);
    DebugLog.startDebugging('l1');
    p.on('data', data => {
      const d = data.toString();
      const result1 = d.includes('this is l1');
      const result2 = d.includes('this is l2');
      if (! result1 && ! result2) {
	err(`no message "this is l1" recieved!`);
      } else if (result2) {
	err(`message "this is l1" recieved!`);
      }
      p.end();
      resolve();
    });
    p.on('error', errMsg => err(errMsg) );
    l1.log('this is l1');
    l2.log('this is l2');
  });
}

l1Test()
  .then(l1l2Test)
  .then( () => log('done') )
  .then( () => process.exit(0) )
  .catch( (errMsg) => err(`promise rejected: ${errMsg}`));


// l1.log('this is l1');

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

