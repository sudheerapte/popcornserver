"use strict";

const [log, err] = require('./logerr.js');
const fileUtils = require('../file-utils.js');
const registry = require('../registry.js');
const path = require('path');

let msg;
let promise;

/*
msg = "--- scan simple dir t1 with 2 .css files";
log(msg);
const t1Path = path.join(__dirname, "t1");
registry.addMachine("t1", t1Path);


promise = fileUtils.getCss(t1Path, ".");
log(`promise returned.`);
let cssfiles = [];
promise.then( (arr) => {
  log(`css files = ${JSON.stringify(arr)}`);
  arr.length === 2 || err("expecting 2 CSS files in t1!");
  Array.prototype.push.apply(cssfiles, arr);
  log(`total cssfiles = ${JSON.stringify(cssfiles)}`);
})
  .catch(errMsg => err(errMsg));
*/

msg = "--- scan dir structure t2";
log(msg);
const t2Path = path.join(__dirname, "t2");
registry.addMachine("t2", t2Path);
let arr = [];
fileUtils.getAllSubdirs(t2Path)
  .then( arr => {
    if (arr.length !== 4) { err('expected array of length 4'); }
  })
  .catch(errMsg => log(errMsg) );


// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

