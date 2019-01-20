"use strict";

const [log, err] = require('./logerr.js');
const registry = require('../registry.js');

let msg;

msg = "--- existence";

registry || err(msg);

const arr = [ "one", "/foo/one", "two", "/bar/two" ];

msg = "--- add two machines";
log(msg);
[0, 1].forEach((i) => {
  registry.addMachine(arr[i*2], arr[i*2+1]) || err(msg);
});

msg = "--- remove two machines";
log(msg);
[0, 1].forEach((i) => {
  registry.removeMachine(arr[i*2]) || err(msg);
});

msg = "--- add two machines and retrieve first dir";
log(msg);
[0, 1].forEach((i) => {
  registry.addMachine(arr[i*2], arr[i*2+1]) || err(msg);
});
const dir = registry.getMachineDir("one");
if (dir !== "/foo/one") { err(msg); }


msg = "--- newmachine event for adding machine";
log(msg);
let newmachineReceived = false;
registry.on('newmachine', (name, dir) => {
  newmachineReceived = true;
  if (name !== "three" || dir !== "/foo/three") {
    err(msg + " bad newmachine event!");
  }
});
registry.addMachine("three", "/foo/three") || msg + " failed to add";

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    if (! newmachineReceived) { err("no newmachineReceived"); }
  }
});

