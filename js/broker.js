"use strict";

/**
   @module(broker.js) - singleton - manage web clients and apps.

   When an app connects, we add it to the list of apps. (Today popcorn
   only ever has one app, but this class is more general). 
   When a client connects, we find an app that handles that machine,
   and hook them up with each other.

   const broker = require('./broker.js');
   broker.start(); // now listening on TCP port options.appPort

   ... TODO when new app connects...
   ... TODO broker automatically adds app and gets machines ...

   ... on new HTTP websocket client, you call addNewClient() ...
   broker.addNewClient(sock, clientId);
   ... broker sends the client its machine ...
   ... TODO broker connects app and client ...
   // client will automatically be dropped when it disconnects
   

*/

const WebsocketEmitter = require('./websocket-emitter.js');

class Broker {
  constructor() {
    this._map = new Map();
  }
  start() {
  }
  addNewClient(machine, clientId, readStr, writeStr) {
    log(`new client: machine ${machine} clientId ${clientId}`);
    const wse = new WebsocketEmitter(readStr, writeStr);
    schedulePing(wse);
    wse.on('message', data => {
      log(`got message: |${data}|`);
      log(`sending: how are you`);
      wse.sendMessage('how are you', false, () => {
	log(`message sent`);
      });
    });
    wse.on('pong', text => {
      log(`   -- got pong ${text}. Closing websocket.`);
      wse.sendClose(1000, 'done with test.', () => {
	log(`close frame sent.`);
      });
    });
    wse.on('close', (code, reason) => {
      log(`got close code ${code}.`);
    });
  }
  addNewApp(machine, readStr, writeStr) {
    if (! machine || typeof machine !== 'string' ||
	! machine.match(/^[a-z]+$/)) {
      console.log(`addNewApp: bad machine format: ${machine}`);
      return false;
    }
    if (this._map.has(machine)) {
      log(`addNewApp: already have ${machine}. Replacing.`);
    }
    this._map.set(machine, {readStr:readStr, writeStr:writeStr});
    return true;
  }
}

function schedulePing(wse) {
  setTimeout( () => {
    wse.sendPing('howdy', () => log(`ping sent: howdy`) );
  }, 1000);
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('broker', logger);
function log(str) { logger.log(str); }


module.exports = new Broker();
