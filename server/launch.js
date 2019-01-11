"use strict";

const fs = require('fs');
const path = require('path');
const hsmodule = require('./http-server.js');

let options = JSON.parse(fs.readFileSync(path.join(__dirname, "options.json")));
console.log(JSON.stringify(options));
const httpServer = new hsmodule(8000, options);
