"use strict";

const EventEmitter = require('events');
const crypto = require('crypto');

/**
   @class(WebsocketEmitter) - read and write using websocket frames

   Receives and sends websocket frames from/to read/write streams.
   See RFC 6455, base framing protocol in Section 5.

   A WebsocketEmitter represents a pair of streams carrying these
   base protocol frames to and from a peer.

   You can use it to send and receive messages over websocket. A
   message (which is a sequence of bytes) can be broken up into one or
   more websocket data frames. It is the data frames that are
   exchanged. Each data frame is marked as either a continuation frame
   or the final frame of a message.

   To write a message to your peer, you have two options:
   - if you have the entire message available in a string or
     buffer, you can call sendMessage(). (Most common).
   - if you want to stream the message in multiple writes, you
     can make multiple sendFrame() calls followed by endMessage().
     Make sure to check the return value of sendFrame(). If it
     returns false, then the websocket is full; try again later.
     (TODO not implemented)
   - In either case, you can pass an optional second argument to
     the sendMessage(), called "masked". This is set only by
     browser clients, so we rarely need to use it. See the RFC.

   To read a message, you subscribe to the 'frame' event.
   - Usually, it returns to you the contents and the option
     "wholeMessage" = true.
   - if the message is larger than one frame, you will get each
     frame with wholeMessage = false. The last frame of the message
     will have the option "fin" = true.

   Usage:

    const WebsocketEmitter = require('websocket-emitter.js');

    ... obtain read and write streams from a websocket ...
    ... if it is a real TCP socket, then use the same duplex socket
        as both the readStream and the writeStream ...

    const wse = new WebsocketEmitter(aReadStream, aWriteStream);
    wse.on('frame', (buf, options) => ... )
    wse.sendMessage('hello world', masked = true);

   METHODS:

     sendMessage(buf, masked = false, cb)
       - buf can be a Buffer or a String (utf-8)
     sendFrame ... TODO not implemented
     endMessage ... TODO not implemented

    EVENTS:

      'frame' (buf, options)
        - a frame has arrived. The payload is in 'buf', a Buffer.
	- options:
        - wholeMessage: true iff entire message is in this frame
        - fin: true iff this is the last frame of this message
 */


class WebsocketEmitter extends EventEmitter {
  constructor(readStream, writeStream) {
    super();
    this._readStream = readStream;
    this._writeStream = writeStream;
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
  }
  _readData(data) {
    log(`_readData len = ${data.length} type = ${typeof data}`);
    let first = data.readUInt8(0);
    log(`first = ${first.toString(16)}`);
    if ((first & 128) !== 128) {
      console.log(`*** TODO readData without FIN not implemented ***`);
      return;
    }
    log(`opcode = ${first & 15}`);
    let second = data.readUInt8(1);
    log(`second = ${second.toString(16)}`);
    let masked = (second & 128) === 128 ? true : false;
    const masklen = masked ? 4 : 0;
    log(`masked = ${masked}`);
    let len = second & 127;
    log(`payload len = ${len}`);
    if (len > 125) {
      console.log(`*** TODO extended payloads not supported`);
      return;
    }
    const extpayloadlen = 0; // TODO extended paylods not supported
    const offset = 2+masklen+extpayloadlen;
    if (data.length !== offset+len) {
      console.log(`*** data length = ${data.length}`);
      console.log(`*** expected = ${offset+len}`);
      return;
    }
    if (masked) {
      for (let i=0; i<len; i++) {
	data[i+offset] = data[i+offset] ^ data[2+extpayloadlen+(i%4)];
      }
    }
    const incoming = data.slice(offset).toString();
    log(`incoming = |${incoming}|`);
    this.emit('message', incoming);
  }
  _readErr(errMsg) { log(`error on readStream: ${errMsg}`); }
  _readClose() { log(`got close event on readStream.`); }
  _writeErr(errMsg) { log(`error on writeStream: ${errMsg}`); }
  _writeClose() { log(`got close event on writeStream.`); }
  sendMessage(buf, masked = false, cb) {
    if (! cb) { cb = ()=>{}; }
    if (typeof buf === 'string') {
      buf = Buffer.from(buf);
    }
    log(`sendMessage: masked = ${masked}`);
    this._fillFrame(buf, masked);
    const frame = this._buffer.slice(0, this._frameSize);
    // const frame = this._buffer;
    const done = this._writeStream.write(frame, 'utf8');
    if (done) {
      cb();
    } else {
      this._writeStream.once('drain', () => cb() );
    }
  }
  _fillFrame(buf, masked) {
    let extpayloadlen = 0; // TODO extended payloads not supported
    let masklen = (masked ? 4 : 0);
    const len = buf.length;
    log(`encoding payload |${buf}|`);
    if (len > 125) {
      console.log(`*** TODO length > 125 not implemented ***`);
      return;
    }
    let first = 128;          // FIN = 1, RSV1=RSV2=RSV3 = 0
    first = first | 1;        // opcode = text, 0x1
    this._buffer.writeUInt8(first, 0);
    let second = (masked ? 128 : 0);
    second = second | len;
    this._buffer.writeUInt8(second, 1);
    const offset = 2 + extpayloadlen + masklen;
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

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  if (process.env["DEBUG"] < 2) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO WebsocketEmitter: ${str}`);
}

module.exports = WebsocketEmitter;
