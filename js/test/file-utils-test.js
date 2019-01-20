"use strict";

const [log, err] = require('./logerr.js');
const fileUtils = require('../file-utils.js');
const registry = require('../registry.js');
const path = require('path');

let promise;

let msg1 = "--- scan simple dir t1 with 2 .css files";
log(msg1);
const t1Path = path.join(__dirname, "t1");
registry.addMachine("t1", t1Path);

let msg2 = "--- scan dir structure t2";
const t2Path = path.join(__dirname, "t2");
registry.addMachine("t2", t2Path);
let arr = [];
fileUtils.getAllSubdirs(t2Path)
  .then( arr => {
    log(msg2);
    if (arr.length !== 4) { err('expected array of length 4'); }
  })
  .catch(errMsg => log(`${msg}: ${errMsg}`) );

let msg3 = "--- find 2 CSS files in t1";
promise = fileUtils.getCss(t1Path);
promise.then( (arr) => {
  log(msg3);
  // log(`css files = ${JSON.stringify(arr)}`);
  arr.length === 2 || err("expecting 2 CSS files in t1!");
})
  .catch(errMsg => err(errMsg));

let msg4 = "--- find 6 CSS files under t2";
promise = fileUtils.getAllCss(t2Path);
promise.then( (arr) => {
  log(msg4);
  // log(`css files = ${JSON.stringify(arr)}`);
  arr.length === 6 || err("expecting 6 CSS files under t2!");
})
  .catch(errMsg => err(errMsg));

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

