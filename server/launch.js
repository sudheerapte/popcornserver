"use strict";

const fs = require('fs');
const path = require('path');
const registry = require('./registry.js');
const hsmodule = require('./http-server.js');
const options = require('./get-options-sync.js');


Object.keys(options).forEach( k => registry.addMachine(k, options[k]) );
const httpServer = new hsmodule(8000);
