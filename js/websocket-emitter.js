"use strict";

const EventEmitter = require('events');

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
    writeStream.on('error', errMsg => this._writeErr(errMsg) );
    writeStream.on('close', () => this._writeClose() );
    this._buffer = Buffer.alloc(125); // smallest possible size
    this._frameSize =0;
  }
  _readData(data) {
    console.log(`_readData len = ${data.length}`);
    let first = data.readUInt8(0);
    if (first & 128 === 0) {
      console.log(`*** TODO readData without FIN not implemented ***`);
      return;
    }
    console.log(`first = ${first.toString(16)}`);
    console.log(`opcode = ${first & 15}`);
    let second = data.readUInt8(1);
    if (second & 128 === 0) {
      console.log(`*** TODO readData without MASK not implemented ***`);
      return;
    }
    console.log(`second = ${second.toString(16)}`);
    console.log(`payload len = ${second & 127}`);
    for (let i=0; i<data.length-6; i++) {
      data[i+6] = data[i+6] ^ data[2+(i%4)];
    }
    console.log(`incoming = |${data.slice(6).toString()}|`);
  }
  _readErr(errMsg) { console.log(`error on readStream: ${errMsg}`); }
  _readClose() { console.log(`got close event on readStream.`); }
  _writeErr(errMsg) { console.log(`error on writeStream: ${errMsg}`); }
  _writeClose() { console.log(`got close event on writeStream.`); }
  sendMessage(buf, masked = false, cb) {
    if (! cb) { cb = ()=>{}; }
    if (typeof buf !== 'string') {
      console.log(`*** TODO non-string buf not implemented ***`);
      return;
    }
    this._setHeader(buf, masked);
    this._setPayload(buf, masked);
    const frame = this._buffer.slice(0, this._frameSize);
    // const frame = this._buffer;
    const done = this._writeStream.write(frame, 'utf8');
    console.log(frame);
    if (done) {
      cb();
    } else {
      this._writeStream.once('drain', () => cb() );
    }
  }
  _setHeader(buf, masked) {
    if (masked) {
      console.log(`*** TODO masked = true not implemented ***`);
      return;
    }
    const len = buf.length;
    log(`encoding payload |${buf}|`);
    if (len > 125) {
      console.log(`*** TODO length > 125 not implemented ***`);
      return;
    }
    let first = 128;          // FIN = 1, RSV1=RSV2=RSV3 = 0
    first = first | 1;        // opcode = text, 0x1
    this._buffer.writeUInt8(first, 0);
    let second = 0;       // MASK = 0
    second = second | len; // length = len
    this._buffer.writeUInt8(second, 1);
    this._frameSize = 2 + len;
    log(`frame size = ${this._frameSize}`);
  }
  _setPayload(buf, masked) {
    this._buffer.write(buf, 2, buf.length);
  }
}

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO WebsocketEmitter: ${str}`);
}

module.exports = WebsocketEmitter;
