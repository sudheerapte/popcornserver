"use strict";

const EventEmitter = require('events');
const crypto = require('crypto');

/**
   @class(WebsocketEmitter) - read and write using websocket frames

   Receives and sends websocket frames from/to read/write streams.
   See RFC 6455, base framing protocol in Section 5.

   A WebsocketEmitter takes a pair of streams, usually a socket,
   carrying these base protocol frames to and from a peer. If you are
   a client, you should set the "isClient" parameter in the
   constructor to true. Normally you are a server, and you should
   leave it at its default, false. This parameter is used to decide
   whether your messages go out masked. (Clients mask their payloads
   with a 4-byte random masking key).

   You can send and receive messages over websocket. A message is a
   sequence of bytes. It can be broken up into one or more websocket
   data frames. It is the data frames that are exchanged. Each data
   frame is marked as either a continuation frame or the final frame
   of a message.

   To write a message to your peer, you have two options:
   - if you have the entire message available in a string or
     buffer, you can call sendMessage(). (Most common).
   - if you want to stream the message in multiple writes, you
     can make multiple sendFrame() calls followed by endMessage().
     Make sure to check the return value of sendFrame(). If it
     returns false, then the websocket is full; try again later.
     (TODO sendFrame not implemented)

   To read a message, you have two options:

   - (a) Subscribe to the "message" event. When an entire message from
     the peer is available, you will get the whole thing as a single
     buffer. (this is the most common scenario)

   - (b) If you are expecting huge messages that need to be streamed,
   then subscribe to the 'frame' event. TODO NOT IMPLEMENTED. If the
   frame has one entire message, then this event returns to you the
   contents and the option "fin" = true.  If the message is larger
   than one frame, you will get each frame with fin = false, except
   for the last frame of the message. The last frame will have the
   option "fin" = true. TODO frame events not implemented.

   To close the connection, you should call sendClose(), which sends a
   Close frame to your peer. Your peer will normally send a Close
   frame back, which you will get as a 'close' event. You are
   responsible for closing the actual read and write streams.

   Similarly with Ping and Pong frames and 'ping' and 'pong'
   events. The standard says you should reply with a Pong frame as
   soon as feasible after getting a Ping frame. If you just want to
   keep a hearbeat going, you can send a Pong frame once in a while.

   Usage:

    const WebsocketEmitter = require('websocket-emitter.js');

    ... obtain read and write streams, usually from a websocket ...
    ... if it is a real TCP socket, then use the same duplex socket
        as both the readStream and the writeStream ...

    const wse = new WebsocketEmitter(aReadStream, aWriteStream);
    wse.on('message', (buf) => ... )
    wse.sendMessage('hello world');

   METHODS:

     constructor(readStr, writeStr, isClient = false)
     sendMessage(buf, cb)
       - buf can be a Buffer or a String (utf-8)
     sendClose(code, reason) - returns true if not already closing
     sendPing() - sends a Ping frame; see 'pong' event below
     sendPong() - sends a Pong frame for keepalive
     isLive() - returns true iff this class thinks socket is alive
     sendFrame ... TODO not implemented
     endMessage ... TODO not implemented

    EVENTS:

      'message' (buf)
        - an entire message is received; payload = Buffer buf.
        - TODO only single-frame messages are implemented.

      'close' (code reason) - peer sent us a Close frame. You should
      send a response Close frame by calling sendClose().  The "code"
      is a numeric reason code (decimal), and the "reason" is the
      UTF-8 string sent by the peer.

       'ping' (buf)
         - peer sent us a Ping frame. A response Pong frame has
           already sent by this class. "buf" is any payload sent.

       'pong' (buf)
          - peer sent us a Pong frame. No need to do anything.

      'frame' (buf, options) TODO not implemented
        - a frame has arrived. The payload is in 'buf', a Buffer.
	- options:
        - wholeMessage: true iff entire message is in this frame
        - fin: true iff this is the last frame of this message
 */


class WebsocketEmitter extends EventEmitter {
  constructor(readStream, writeStream, isClient = false) {
    super();
    this._readStream = readStream;
    this._writeStream = writeStream;
    this._masked = isClient;
    readStream.on('data', data => this._readData(data) );
    readStream.on('error', errMsg => this._readErr(errMsg) );
    readStream.on('close', () => this._readClose() );
    readStream.on('end', () => this._readClose() );
    readStream.on('finish', () => this._readClose() );
    writeStream.on('error', errMsg => this._writeErr(errMsg) );
    writeStream.on('close', () => this._writeClose() );
    writeStream.on('end', () => this._writeClose() );
    writeStream.on('finish', () => this._writeClose() );
    this._buffer = Buffer.alloc(125); // smallest possible size
    this._frameSize =0;
    this._live = true;
  }
  isLive() { return this._live; }
  // _readData(data) - data just came over the wire. Parse it.
  _readData(data) {
    if (! isValid(data)) { return; }
    const opcode = doFirstByte(data);
    if (! opcode) { return; }
    let second = data.readUInt8(1);
    let masked = (second & 128) === 128 ? true : false;
    const masklen = masked ? 4 : 0;
    log(`second = ${second.toString(16)} masked = ${masked}`);
    let len = second & 127;
    let extpayloadlen = 0;
    if (len === 126) {
      extpayloadlen = 2;
      len = data.readUInt16BE(2);
    } else if (len === 127) {
      extpayloadlen = 8;
      len = data.readUIntBE(2, 8);
    }
    log(`payload len = ${len} extended payload ${extpayloadlen} bytes`);
    const offset = 2+masklen+extpayloadlen;
    if (data.length !== offset+len) {
      const errMsg = `*** bad data length ${data.length} should be ${offset+len}`;
      console.log(errMsg);
      this.emit('error', errMsg);
      return;
    }
    if (masked) {
      for (let i=0; i<len; i++) {
	data[i+offset] = data[i+offset] ^ data[2+extpayloadlen+(i%4)];
      }
    }
    const payload = data.slice(offset);
    this._processOp(opcode, payload); // done.

    function isValid(data) {
      if (! Buffer.isBuffer(data)) {
	console.log(`*** TODO readData implemented only for Buffer ***`);
	return false;
      }
      if (data.length < 2) {
	console.log(`*** IMPOSSIBLE readData length < 2 ***`);
	return false;
      }
      log(`_readData len = ${data.length} type = ${typeof data}`);
      return true;
    }
    function doFirstByte(data) {
      let first = data.readUInt8(0);
      if ((first & 128) !== 128) {
	const errMsg = `*** TODO readData without FIN not implemented ***`;
	console.log(errMsg);
	this.emit('error', errMsg);
	return null;
      }
      const opcode = first & 15;
      log(`first = ${first.toString(16)} opcode = ${opcode}`);
      return opcode;
    }
  }
  // _processOp() - given opcode and unmasked payload
  _processOp(opcode, payload) {
    log(`incoming payload length = ${payload.length}`);
    if (opcode === 0 || opcode === 1) {
      this.emit('message', payload.toString());
      return;
    }
    // We have a control frame.
    log(`    opcode = ${opcode}`);
    if (opcode === 8) { // Close
      const reasonCode = payload.readUInt16BE(0);
      const text = payload.slice(2).toString();
      this.emit('close', reasonCode, text); return;
    } else if (opcode === 9) { // Ping
      this.emit('ping', payload.toString()); return;
    } else if (opcode === 10) { // Pong
      this.emit('pong', payload.toString()); return;
    }
  }
  _readErr(errMsg) { log(`error on readStream: ${errMsg}`); }
  _readClose() { log(`got close event on readStream.`); }
  _writeErr(errMsg) { log(`error on writeStream: ${errMsg}`); }
  _writeClose() { log(`got close event on writeStream.`); }
  sendMessage(buf, cb) {
    if (! this.isLive()) { return false };
    if (! cb) { cb = ()=>{}; }
    if (typeof buf === 'string') {
      buf = Buffer.from(buf);
    }
    this._fillFrame(1, buf, this._masked);  // grows if necessary
    const frame = this._buffer.slice(0, this._frameSize);
    // const frame = this._buffer;
    const done = this._writeStream.write(frame, 'utf8');
    if (done) {
      cb();
    } else {
      this._writeStream.once('drain', () => cb() );
    }
    return true;
  }
  sendClose(code, reason, cb) {
    if (! this.isLive()) { return false };
    let buf = Buffer.from('  ' + reason);
    buf.writeUInt16BE(code, 0);
    this._fillFrame(8, buf, this._masked);
    const frame = this._buffer.slice(0, this._frameSize);
    const done = this._writeStream.write(frame, 'utf8');
    if (done) {
      this._live = false;
      cb();
    } else {
      this._writeStream.once('drain', () => {
	this._live = false;
	cb();
      });
    }
    return true;
  }
  sendPing(payload, cb) {
    if (! this.isLive()) { return false };
    let buf = Buffer.from(payload);
    this._fillFrame(9, buf, this._masked);
    const frame = this._buffer.slice(0, this._frameSize);
    const done = this._writeStream.write(frame, 'utf8');
    if (done) {
      cb();
    } else {
      this._writeStream.once('drain', () => cb() );
    }
    return true;
  }
  sendPong(payload, cb) {
    if (! this.isLive()) { return false };
    let buf = Buffer.from(payload);
    this._fillFrame(10, buf, this._masked);
    const frame = this._buffer.slice(0, this._frameSize);
    const done = this._writeStream.write(frame, 'utf8');
    if (done) {
      cb();
    } else {
      this._writeStream.once('drain', () => cb() );
    }
    return true;
  }
  // _fillFrame() - fill our _frame with given payload
  _fillFrame(opcode, buf, masked) {
    let extpayloadlen = 0;
    let offset = 2;
    let masklen = (masked ? 4 : 0);
    const len = buf.length;
    log(`encoding payload for buf length ${len}`);
    const TWOBYTE = Math.pow(2, 16);
    if (len > TWOBYTE) {
      log(`extended payload 8 bytes`);
      extpayloadlen = 8;
      offset = 2 + extpayloadlen + masklen;
      if (this._buffer.length < (offset+len)) {
	log(`growing internal buffer to ${offset+len} bytes`);
	this._buffer = Buffer.alloc(offset+len);
      }
    } else if (len > 125) {
      log(`extended payload 2 bytes`);
      extpayloadlen = 2;
      offset = 2 + extpayloadlen + masklen;
      if (this._buffer.length < (offset+len)) {
	log(`growing internal buffer to ${offset+len} bytes`);
	this._buffer = Buffer.alloc(offset+len);
      }
    } else {
      log(`no extended payload`);
      offset = 2 + extpayloadlen + masklen;
    }
    let first = 128;          // FIN = 1, RSV1=RSV2=RSV3 = 0
    first = first | opcode;
    this._buffer.writeUInt8(first, 0);
    let second = (masked ? 128 : 0);
    if (extpayloadlen === 0) {
      second = second | len;
    } else if (extpayloadlen === 2) {
      second = second | 126;
      this._buffer.writeUInt16BE(len, 2);
    } else if (extpayloadlen === 8) {
      second = second | 127;
      this._buffer.writeUIntBE(len, 2, 8);
    }
    this._buffer.writeUInt8(second, 1);
    this._frameSize =  offset + len;
    if (masked) {
      crypto.randomFillSync(this._buffer, 2+extpayloadlen, 4);
    }
    log(`frame size = ${this._frameSize}`);
    // write payload
    if (masked) {
      for (let i=0; i<len; i++) {
	this._buffer[i+offset] = buf[i] ^ this._buffer[2+extpayloadlen+(i%4)];
      }
    } else {
      const result = buf.copy(this._buffer, offset, 0, len);
      if (result !== len) {
	console.log(`*** failed to copy ${len} bytes: only ${result} copied`);
	return;
      }
    }
  }
}

// create logging function log(str). Copy and paste these lines.
let log = () => {};
const logFileName = require('path').basename(__filename, '.js');
if (process.env["DEBUG"] &&
    process.env["DEBUG"].indexOf(logFileName) >= 0) {
  console.log(`[debugging ${logFileName}]`);
  log = str => {
    const d = new Date();
    console.log(`[${d.toISOString()}] INFO ${logFileName}: ${str}`);
  };
}

module.exports = WebsocketEmitter;
