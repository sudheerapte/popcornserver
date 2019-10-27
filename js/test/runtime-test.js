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

execINITP()
  .then( execINITerrorP )
  .catch( errMsg => log(errMsg) );


/**
   The beginning of each test is "commonStepsP", i.e.,:
    provideStepP - interprets providedMachineLines
    initStepP - execProc("INIT")
    renderStepP - execProc("RENDER")
*/

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
function renderStepP() {
  return new Promise( (resolve, reject) => {
    runtimeHandler = s => reject(s);
    P.execProc("RENDER");
    return resolve();
  });
}

function commonStepsP() {
  return new Promise( (resolve, reject) => {
    provideStepP()
      .then( initStepP )
      .then( renderStepP )
      .then( () => {
        resolve();
      })
      .catch( errMsg => reject(errMsg) );
  });
}


function setupINITP() {
  return new Promise( (resolve, reject) => {
    providedMachineLines = [
      "addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar",
    ];
    lines = [
      "%INIT",
      "DEF ROOT CHILDREN c",
      "",
      "%RENDER",
      "",
    ];
    resolve();
  });
}

function execINITP() {
  return new Promise( (resolve, reject) => {
    log(`---- INIT`);
    setupINITP()
      .then( commonStepsP )
      .then( () => {
        if (! mc.exists(".c")) {
          err("expected .c to exist!");
        }
        resolve();
      })
      .catch( errMsg => err(errMsg) );
  });
}


function setupINITerrorP() {
  return new Promise( (resolve, reject) => {
    providedMachineLines = [
      "addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar",
    ];
    lines = [
      "%INIT",
      "DEF ROOT c",
      "",
      "%RENDER",
      "",
    ];
    resolve();
  });
}

function execINITerrorP() {
  return new Promise( (resolve, reject) => {
    log(`---- INIT with one error`);
    setupINITerrorP()
      .then( commonStepsP )
      .then( () => {
        err(`test failed`);
      })
      .catch( errMsg => {
        errDiff(errMsg, "proc INIT: DEF ROOT: bad option: c");
        resolve();
      });
  });
}




