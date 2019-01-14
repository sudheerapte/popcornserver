"use strict";

const fs = require('fs');
const path = require('path');
const registry = require('./registry.js');
const hsmodule = require('./http-server.js');

let options = JSON.parse(fs.readFileSync(path.join(__dirname, "options.json")));
console.log(JSON.stringify(options));
Object.keys(options).forEach( k => registry.addMachine(k, options[k]) );
const httpServer = new hsmodule(8000);
