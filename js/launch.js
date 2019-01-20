"use strict";

/**
   This is the main program for popcorn.  We simply start the servers
   and hook them up according to the configuration file.  Things will
   start happening once clients start connecting.
*/

const broker = require('./broker.js');
const hsmodule = require('./http-server.js');

function launch() {
  const options = require('./get-options-sync.js');
  let port = options.httpPort || "8000";
  if (port >= 65536 || port <= 0) { port = 8000; }
  console.log(`listening on http://localhost:${port}`);
  const httpServer = new hsmodule(port);
  httpServer.on('wssocket', (sock, idObj) => broker.addNewClient(sock, idObj));
  broker.start();
  httpServer.start();
}

setImmediate(launch);
