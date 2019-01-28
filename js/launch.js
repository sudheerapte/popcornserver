"use strict";

/**
   This is the main program for popcorn.  We simply start the servers
   and hook them up according to the configuration file.  Things will
   start happening once clients start connecting.
*/

const broker = require('./broker.js');
const hsmodule = require('./http-server.js');
const registry = require('./registry.js');

function launch() {
  const options = require('./get-options-sync.js');
  let port = options.httpPort || "8000";
  if (port >= 65536 || port <= 0) { port = 8000; }
  console.log(`listening on http://localhost:${port}`);
  // We use the options to cache machine info into the registry.
  const machineObj = options.machineDirs || {"demo": "%D/demo"};
  Object.keys(machineObj).forEach( k => {
    if (k.match(/^[a-z0-9]+$/)) {
      registry.addMachine(k, machineObj[k]);
    } else {
      console.log(`machine name: ${k} not lowercase; ignoring`);
    }
  });
  // Whenever httpServer gets a new websocket, add the new client
  // to the broker.
  const httpServer = new hsmodule(port);
  httpServer.on('wssocket', (sock, idObj) => {
    let {origin, key, url} = idObj;
    if (url.startsWith("/")) { url = url.substr(1); }
    broker.addNewClient(url, origin+"|"+key, sock, sock);
  });
  httpServer.start();
}

setImmediate(launch);
