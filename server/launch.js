"use strict";

const fs = require('fs');
const path = require('path');
const registry = require('./registry.js');
const hsmodule = require('./http-server.js');
const options = require('./get-options-sync.js');

const machineObj = options.machineDirs || {"demo": "%D/demo"};
Object.keys(machineObj).forEach( k => {
  registry.addMachine(k, machineObj[k]);
});
let port = options.port || "8000";
const httpServer = new hsmodule(8000);
