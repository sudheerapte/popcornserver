"use strict";

const EventEmitter = require('events');

/**
   @class(WebsocketEmitter) - read and write using websocket frames

   Receives and sends websocket frames from/to read/write streams.
   See RFC 6455, base framing protocol in Section 5.

   A WebsocketEmitter represents a pair of streams carrying these
   base protocol frames to and from a peer.

   Usage:

    const WebsocketEmitter = require('websocket-emitter.js');
    const wse = new WebsocketEmitter(aReadStream, aWriteStream);
    wse.on('frame', (buf, options) => ... )
    wse.write('hello world', {masked: true});

   METHODS:

     write(payload, options, cb)
       - writes the payload (a Buffer) into the writable
         stream as a single frame (or numFrames, if specified).
       - options and defaults:
            encoding ('utf-8')
	           if 'binary', then arbitrary octets.
		   if 'utf-8', then payload can be a String.
            masked (false) - whether to mask the data (clients do)
	    maskKey (undefined) - 4-byte Buffer, iff masked = true
	    numFrames (1) - how many frames to split the data into
       - cb - optional callback, with null or an error message.
    
    EVENTS:

      'frame' (buffer, options)
        - a frame has arrived. The payload is in 'buffer'.
	- options are as above.
 */


class WebsocketEmitter extends EventEmitter {
}

module.export = WebsocketEmitter;
