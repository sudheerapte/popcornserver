"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Runtime = require('../runtime.js');
const P = new Runtime;

log(`---- include`);
P.setSingleton("foo", {});

log(P.getSingleton("foo"));



