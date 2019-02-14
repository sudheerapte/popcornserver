"use strict";

const [log, err] = require('./logerr.js');
const Machine = require('../machine.js');

const machineLines = [
  "P .hinge/open",
  "P .hinge/closed",
  "P .bolt/unlocked",
  "P .bolt/locked",
];

const mc = new Machine();
const result = mc.interpret(machineLines);
err(result);

function isNonCurrAlt(mPath) {
  const state = mc.getState(mPath);
  if (state) { // check if state is a non-current alternative child
    const parent = state.parent;
    if (parent.hasOwnProperty("curr") && parent.hasOwnProperty("cc")) {
      if (parent.cc[parent.curr] === state.name) {
        return false;
      } else {
        return true;
      }
    }
  }
  return false;
}

machineLines.map( line => line.split(' ')[1] )
  .forEach( mPath => {
    const result = isNonCurrAlt(mPath);
    if (result) { log(`${mPath}: make invisible`) }
  });

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

