"use strict";

const [log, err] = require('./logerr.js');
const fileUtils = require('../file-utils.js');
const registry = require('../registry.js');
const Pipe = require('stream').PassThrough;
const path = require('path');

let promise;

let msg1 = "--- verify this source file";
log(msg1);

const pipe = new Pipe();
function findFileUtils() {
  return new Promise( (resolve, reject) => {
    let foundFileUtilsDeclaration = false;
    pipe.on('data', data => {
      if (data.toString().match(/fileUtils/)) {
        foundFileUtilsDeclaration = true;
        return resolve();
      }
    });
    pipe.on('error', errMsg => reject(errMsg) );
    pipe.on('end', ()=> {
      if (! foundFileUtilsDeclaration) {
        reject(`failed to find fileUtils`);
      } else {
        log(`done scanning file ${__filename}`);
      }
    });
  });
}
fileUtils.streamFP(__filename, pipe)
  .then( findFileUtils )
  .then( () => log(`done`) )
  .catch( errMsg => err(errMsg) );


// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

