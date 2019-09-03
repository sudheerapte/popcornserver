"use strict";

const Machine = require("../newmachine.js");
let machine = new Machine();

let log, err, errDiff;
[log, err, errDiff] = require('./logerr.js');

let result;
let undos;

log(`---- addLeaf, undos, unundos`);

// Build up machine using list, then use undos to empty it.
// While using undos, build unundos list.
// FInally, use unundos to rebuild the original machine.

let list = [
  'addLeaf . a',
  'addLeaf . b',
  'addLeaf .b . c',
  'addLeaf .b . d',
  'addLeaf .b . e',
  'addLeaf .a . f',
];

machine = new Machine();
undos = [];
for (let i=0; i<list.length; i++) {
  err(machine.doCommand(list[i], undos));
}
errDiff(machine.getAllPaths().length, list.length+1);
errDiff(machine.getCurrentPaths().length, list.length+1);
errDiff(machine.getAllPaths().length, list.length+1);
errDiff(undos.length, list.length);

let unundos = [];
for (let i=0; i<undos.length; i++) {
  err(machine.doCommand(undos[i], unundos));
}
errDiff(machine.getAllPaths().length, 1);
errDiff(undos.length, list.length);

log(`---- build copy with redos`);

let machinecopy = new Machine();
undos = [];
for (let i=0; i<unundos.length; i++) {
  err(machinecopy.doCommand(unundos[i], undos));
}

//log(`comparing with original...`);
let orig = new Machine();
undos = [];
for (let i=0; i<list.length; i++) {
  orig.doCommand(list[i], undos);
}
if (!machinecopy.isEqual(orig)) {
  err(`*** machinecopy is not equal to orig`);
}

log(`---- clone`);
machine = new Machine();
undos = [];
for (let i=0; i<list.length; i++) {
  err(machine.doCommand(list[i], undos));
}
machinecopy = machine.clone();
machine.getAllPaths().forEach( p => {
  if (! machinecopy.exists(p)) {
    err(`*** machinecopy does not have path |${p}|`);
  }
});
machinecopy.getAllPaths().forEach( p => {
  if (! machine.exists(p)) {
    err(`*** machine does not have clone's path |${p}|`);
  }
});


// --------------------------

process.on('beforeExit', code => {
  if (code === 0) {
    /*
    if (event3Triggered) {
      err(`event3 was triggered!`);
    }
    if (!event5Triggered) {
      err(`event5 was never triggered!`);
    }
    if (! gotNewMachineEvent) {
      err('failed to get newmachine event on finishEditing()');
    }
    */
  }
});
