"use strict";

/**
   @module(broker.js) - singleton - manage web clients and apps.

   When an app connects, we add it to the list of apps. (Today popcorn
   only ever has one app, but this class is more general). When an HTTP
   client connects over websocket, we add it to the list of clients,
   and look to see if an app serves the same model and connect the two.

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

const registry = require('./registry.js');
const WebsocketEmitter = require('./websocket-emitter.js');

class Broker {
  start() {
    // We use the options to cache machine info into the registry.
    const options = require('./get-options-sync.js');
    const machineObj = options.machineDirs || {"demo": "%D/demo"};
    Object.keys(machineObj).forEach( k => {
      if (k.match(/^[a-z0-9]+$/)) {
	registry.addMachine(k, machineObj[k]);
      } else {
	console.log(`machine name: ${k} not lowercase; ignoring`);
      }
    });
  }
  addNewClient(sock, idObj) {
    let { origin, key, url } = idObj;
    console.log(`web socket on: origin ${origin} key ${key} url ${url}`);
    const wse = new WebsocketEmitter(sock, sock);
    sock.on('data', data => {
      console.log(`sending: how are you`);
      wse.sendMessage('how are you', false, () => {
	console.log(`message sent`);
      });
    });
  }
}

module.exports = new Broker();
