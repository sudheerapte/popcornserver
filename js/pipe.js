"use strict";

const {Duplex} = require('stream');

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

module.exports = Pipe;
