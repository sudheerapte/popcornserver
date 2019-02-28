"use strict";

/**
   This is the main program for popcorn.  We simply start the servers
   and hook them up according to the configuration file.  Things will
   start happening once clients start connecting.
*/

const broker = require('./web-broker.js');
const hsmodule = require('./http-server.js');
const registry = require('./registry.js');
const Machine = require('./machine.js');
const appServer = require('./app-server.js');
const GetOptions = require('./get-options.js');
const demoApp = require('./demo-app.js');

function launch(jsonOpts) {
  let options = {host: "localhost", port: "8000"};
  if (jsonOpts.httpPort) { options.port = jsonOpts.httpPort; }
  if (jsonOpts.httpHost) { options.host = jsonOpts.httpHost; }
  console.log(`listening on http://${options.host}:${options.port}`);
  // We use the options to cache machine info into the registry.
  const machineObj = jsonOpts.machineDirs || {"demo": "%D/demo"};
  Object.keys(machineObj).forEach( k => {
    if (k.match(/^[a-z0-9]+$/)) {
      registry.addMachine(k, machineObj[k]);
    } else {
      console.log(`machine name: ${k} not lowercase; ignoring`);
    }
  });
  // Whenever httpServer gets a new websocket, add the new client
  // to the broker.
  const httpServer = new hsmodule(options);
  const APPPORT = jsonOpts.appPort || "8001";
  appServer.on('provide', (appName, machine, mc) => {
    broker.provide(machine, mc);
  })
  broker.on('command', (machine, clientId, arr) => {
    appServer.doCommand(machine, clientId, arr);
  });
  appServer.startListening({port: APPPORT})
    .then( () => {
      httpServer.on('wssocket', (sock, idObj) => {
	let {origin, key, url} = idObj;
	broker.addNewClient(origin+"|"+key, url, sock, sock);
      });
      demoApp.start(APPPORT)
        .then( () => {
          console.log(`demoApp started on port ${APPPORT}`);
          httpServer.start();
        })
        .catch(errMsg => console.log(`demoApp: ${errMsg}`) );
    })
    .catch( errMsg => {
      console.log(errMsg);
      process.exit(1);
    });
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('launch', logger);
function log(str) { logger.log(str); }

GetOptions.get()
  .then( jsonOpts => launch(jsonOpts) )
  .catch( errMsg => console.log(errMsg) );

