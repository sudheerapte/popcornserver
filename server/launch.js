"use strict";

/**
   This is the main program for popcorn.  We simply start the servers
   and hook them up according to the configuration file.  Things will
   start happening once clients start connecting.
*/

const registry = require('./registry.js');
const hsmodule = require('./http-server.js');
const options = require('./get-options-sync.js');
const WebsocketEmitter = require('./websocket-emitter.js');

// The options.json file is read by the get-options-sync module.
// We use the options to cache some info into the registry.
const machineObj = options.machineDirs || {"demo": "%D/demo"};
Object.keys(machineObj).forEach( k => {
  if (k.match(/^[a-z0-9]+$/)) {
    registry.addMachine(k, machineObj[k]);
  } else {
    console.log(`machine name: ${k} not lowercase; ignoring`);
  }
});
// Start the HTTP server for web clients.
let port = options.httpPort || "8000";
if (port >= 65536 || port <= 0) { port = 8000; }
console.log(`listening on http://localhost:${port}`);
const httpServer = new hsmodule(port);
httpServer.on('wssocket', onWebsocketOpen);
httpServer.start();

function onWebsocketOpen(sock, idObj) {
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
