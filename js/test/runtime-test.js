"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Machine = require('../machine.js');
const Runtime = require('../runtime.js');
const Parser = require('../parser.js');
const Tokenizer = require('../tokenizer.js');
const t = new Tokenizer;
const Executor = require('../executor.js');

// Runtime log message handler. Set this before calling Runtime
let runtimeHandler = s => console.log(s);

const P = new Runtime( s => runtimeHandler(s) );

let providedMachineLines, mc, e, lines;

function provideStepP() {
  return new Promise( (resolve, reject) => {
    mc = new Machine;
    mc.interpret(providedMachineLines);
    e = new Executor(mc, t, new Parser(t), log);
    P.setExecutor(e);
    runtimeHandler = s => reject(s);
    P.buildProcsMap(lines);
    return resolve();
  });
}

function initStepP() {
  return new Promise( (resolve, reject) => {
    runtimeHandler = s => reject(s);
    P.execProc("INIT");
    return resolve();
  });
}


log(`---- INIT`);

providedMachineLines = [
  "addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar",
];
lines = [
  "%INIT",
  "DEF ROOT CHILDREN c",
  "",
];

provideStepP()
  .then( initStepP )
  .then( testStepP )
  .catch( errMsg => {
    errDiff(errMsg, "proc INIT: DEF ROOT: bad option: c");
  });

function testStepP() {
  return new Promise( (resolve, reject) => {
    err(mc.exists(".c"));
    resolve();
  });
}

log(`---- INIT with one error`);

providedMachineLines = [
  "addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar",
];
lines = [
  "%INIT",
  "DEF ROOT c",
  "",
];

provideStepP()
  .then( initStepP )
  .then( testStepP )
  .catch( errMsg => {
    errDiff(errMsg, "proc INIT: DEF ROOT: bad option: c");
  });

function testStepP() {
  return new Promise( (resolve, reject) => {
    log(P.getMc().serialize());
  });
}

