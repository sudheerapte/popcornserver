"use strict";

const Machine = require("../newmachine.js");
let machine = new Machine();

let log, err, errDiff;
[log, err, errDiff] = require('./logerr.js');

let list, copy;
let result;
let undos;

log(`---- clone test`);

list = [
  'addLeaf . a',
  'addLeaf . b',
  'addLeaf .a / c',
  'addLeaf .a / d',
  'addLeaf .b / e',
  'addLeaf .b / f',
];

machine = new Machine();
undos = [];
for (let i=0; i<list.length; i++) {
  err(machine.doCommand(list[i], undos));
}
copy = machine.clone();
log(`---- comparing with copy`);
errDiff(machine.isEqual(copy), true);
undos = [];
result = copy.doCommand('setCurrent .b f', undos); err(result);
errDiff(machine.isEqual(copy), false);
log(`---- running undos on the copy`);
result = copy.doCommand(undos[0], undos); err(result);
errDiff(machine.isEqual(copy), true);

log(`---- addLeaf, undos, unundos`);


function printStates(machine) {
  machine._paths.forEach( (s, p) => {
    const parent = s.parent.name;
    let details = "";
    if (s.hasOwnProperty("cc")) {
      details = "[" + s.cc.length + "]";
      if (s.hasOwnProperty("curr")) { details += "."+s.curr; }
    } else {
      if (s.hasOwnProperty("data")) {
        details += "data = |" + s.data + "|";
      }
    }
    log(` [|${s.name}| parent=|${parent}| ${details}]`);
  });
}

// Build up machine using list, then use undos to empty it.
// While using undos, build unundos list.
// FInally, use unundos to rebuild the original machine.

list = [
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

// addLeaf - not an alt parent
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
result = machine.doCommand("addLeaf .a . b", undos); err(result);
result = machine.doCommand("addLeaf .a / c", undos);
if (! result.match(/^not an alt/)) {
  err(`*** did not get 'not an alt parent' error: got |${result}|`);
}

// addLeaf - parent has data
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
result = machine.doCommand("setData .a fooBar", undos); err(result);
result = machine.doCommand("addLeaf .a . b", undos);
if (! result.match(/^parent has data/)) {
  err(`*** did not get 'parent has data' error: got |${result}|`);
}

// addLeaf turning a leaf into an alt parent
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
result = machine.doCommand("addLeaf .a / b", undos); err(result);
if (! machine.isAltParent(".a")) {
  err(`.a is not alt parent!`);
}
result = machine.getCurrent(".a"); err(result[0]);
if (result[1] !== "b") {
  err(`*** addLeaf did not set current pointer to "b"`);
}

// deleteLastLeaf turning an alt parent into a leaf
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
err(machine.isLeaf(".a"));
result = machine.doCommand("addLeaf .a / b", undos); err(result);
err(machine.isAltParent(".a"));
result = machine.doCommand("addLeaf .a / c", undos); err(result);
result = machine.doCommand("deleteLastLeaf .a", undos); err(result);
result = machine.doCommand("deleteLastLeaf .a", undos); err(result);
err(machine.isLeaf(".a"));

// deleteLastLeaf - try undo with an alt parent
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
undos = [];
result = machine.doCommand("addLeaf .a / b", undos); err(result);
unundos = [];
for (let i=0; i<undos.length; i++) {
  //log(`    running undo command: ${undos[i]}`);
  result = machine.doCommand(undos[i], unundos); err(result);
}
err(machine.isLeaf(".a"));

// deleteLastLeaf - setCurrent and try undo with an alt parent
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
result = machine.doCommand("addLeaf .a / b", undos); err(result);
result = machine.doCommand("addLeaf .a / c", undos); err(result);
result = machine.setCurrent(".a", "c", undos); err(result);
let cmd = "deleteLastLeaf .a";
result = machine.doCommand(cmd, undos); err(result);
result = machine.getCurrent(".a"); err(result[0]);
errDiff(result[1], "b");

log(`---- setCurrent`);
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
result = machine.doCommand("addLeaf .a / b", undos); err(result);
result = machine.doCommand("addLeaf .a / c", undos); err(result);
//log(`current = ${machine.getCurrent(".a")[1]}`);
err(machine.getCurrent(".a")[0]);
errDiff(machine.getCurrent(".a")[1], "b");
undos = [];
result = machine.doCommand("setCurrent .a c", undos); err(result);
errDiff(undos[0], "setCurrent .a b");
err(machine.getCurrent(".a")[0]);
errDiff(machine.getCurrent(".a")[1], "c");
// Try bad current child
result = machine.doCommand("setCurrent .a foo");
errDiff(result, "no such child: foo");

log(`---- setData`);
machine = new Machine();
undos = [];
result = machine.doCommand("addLeaf . a", undos); err(result);
result = machine.doCommand("addLeaf .a / b", undos); err(result);
result = machine.doCommand("setData .a/b foo bar"); err(result);
err(machine.getData(".a/b")[0]);
errDiff(machine.getData(".a/b")[1], "foo bar");
errDiff(machine.getData(".a")[0], "not a leaf: .a");
result = machine.doCommand("setData .a/b baz", undos); err(result);
errDiff(undos[0], "setData .a/b foo bar");
errDiff(machine.getData(".a/b")[1], "baz");
result = machine.doCommand("setData .a/b bat", undos); err(result);
errDiff(undos[0], "setData .a/b baz");
errDiff(machine.getData(".a/b")[1], "bat");

log(`---- interpret`);
machine = new Machine();
undos = [];
let arr1 = [
  "addLeaf . a",
  "addLeaf .a / b",
  "addLeaf .a / c",
];
result = machine.interpret(arr1, undos); err(result);
copy = machine.clone();

errDiff(machine.isEqual(copy), true);
let arr2 = [
  "setData .a/b foo bar",
  "setData .a/b baz",
  "setData .a/b bat",
  "setCurrent .a c",
];
undos = [];
result = machine.interpret(arr2, undos); err(result);
errDiff(machine.isEqual(copy), false);

log(`---- executing undos`);
result = machine.interpret(undos); err(result);
errDiff(machine.isEqual(copy), true);

function printAll(machine) {
  machine._paths.forEach( (n, p) => {
    log(n);
  });
}

log(`---- serialize`);

list = [
  'addLeaf . a',
  'addLeaf . b',
  'addLeaf .a / c',
  'addLeaf .a / d',
  'addLeaf .b / e',
  'addLeaf .b / f',
  'setData .b/e foo bar',
  'setData .b/e',
  'addLeaf .b/e . g',
];

machine = new Machine();
undos = [];
result = machine.interpret(list, undos); err(result);
//log(machine.serialize());
const list2 = machine.serialize();
copy = new Machine();
undos = [];
result = copy.interpret(list2); err(result);
err(machine.isEqual(copy));

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
