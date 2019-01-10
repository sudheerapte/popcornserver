"use strict";

const hmodule = require('./http-server.js');
const httpServer = new hmodule(8000, {demo: "/home/sapte/d/temp"});
