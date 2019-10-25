"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Machine = require('../machine.js');
const Runtime = require('../runtime.js');
const Parser = require('../parser.js');
const Tokenizer = require('../tokenizer.js');
const t = new Tokenizer;
const Executor = require('../executor.js');

const P = new Runtime( s => log(s) );

log(`---- include`);

let providedMachineLines, mc, e, lines;

function provideStepP() {
  return new Promise( (resolve, reject) => {
    mc = new Machine;
    mc.interpret(providedMachineLines);
    e = new Executor(mc, t, new Parser(t), log);
    P.setExecutor(e);
    P.buildProcsMap(lines);
    return resolve();
  });
}

function initStepP() {
  return new Promise( (resolve, reject) => {
    P.execProc("INIT");
    return resolve();
  });
}

providedMachineLines = [
  "addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar",
];
lines = [
  "%INIT",
  "",
];

provideStepP()
  .then( initStepP )
  .then( () => log("done") );



