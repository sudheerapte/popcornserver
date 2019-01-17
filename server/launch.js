"use strict";

const registry = require('./registry.js');
const hsmodule = require('./http-server.js');
const options = require('./get-options-sync.js');

const machineObj = options.machineDirs || {"demo": "%D/demo"};
Object.keys(machineObj).forEach( k => {
  if (k.match(/^[a-z0-9]+$/)) {
    registry.addMachine(k, machineObj[k]);
  } else {
    console.log(`machine name: ${k} not lowercase; ignoring`);
  }
});
let port = options.httpPort || "8000";
if (port >= 65536 || port <= 0) { port = 8000; }
const httpServer = new hsmodule(port);
