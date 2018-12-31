/**
   Copyright 2018 Sudheer Apte

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

"use strict";

const [log, err] = require('./logerr.js');
const {Writable} = require('stream');
const fsmodule = require('../file-server.js');

let msg;

// -----------------
msg = "1. create fileServer";
log(msg);
const fileServer = new fsmodule('./assets');
fileServer || err(msg);

// -----------------
msg = "2. count bytes of index.html";
log(msg);
let countBytes = 0; // bytes in the contents of index.html
let indexHtmlFinished = false; // did we get a callback
const htmlStr = new Writable({
  write(chunk, encoding, cb) {
    countBytes += chunk.length;
    cb();
  }
});
htmlStr.on('finish', () => {
  countBytes === 53 || err(`htmlStr: countBytes not 53, but ${countBytes}`);
  log('htmlStr contents finished');
});
htmlStr.on('error', (msg) => {
  err(`htmlStr error: ${msg}`);
});
const ctype = fileServer.resolve('/index.html', htmlStr, () => { indexHtmlFinished = true;});
ctype === "text/html" || err(`index.html Content-Type should be text/html: found ${ctype}`);

// -----------------
msg = "3. content-type of example.svg";
log(msg);
let exampleSvgFinished = false;
const svgStr = new Writable({
  write(chunk, encoding, cb) {
    cb();
  }
});
svgStr.on('finish', () => {
});
svgStr.on('error', (msg) => {
  err(`xmlStr error: ${msg}`);
});
const svgtype = fileServer.resolve('/example.svg', svgStr, msg => {
  err(msg);
  exampleSvgFinished = true;
});
svgtype === "image/svg+xml" || err(`example.svg type = ${svgtype}`);

// -----------------
msg = "4. try bad file path";
log(msg);
let badSvgFinished = false;
const bpStr = new Writable({
  write(chunk, encoding, cb) {
    cb();
  }
});
bpStr.on('finish', () => {
  err('error was expected for bad file');
});
bpStr.on('error', (msg) => {
  log(`bpStr error received correctly: ${msg}`);
});
const bptype = fileServer.resolve('/bad.svg', bpStr, msg => {
  if (msg !== 'ENOENT') {
    err('bad.svg should produce error!');
  }
  badSvgFinished = true;
});
bptype === "image/svg+xml" || err(`bad.svg type = ${svgtype}`);

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    if (!indexHtmlFinished) {
      err(`index.html never got callback!`);
    }
    if (!exampleSvgFinished) {
      err(`example.svg never got callback!`);
    }
    if (!badSvgFinished) {
      err(`bad.svg never got callback!`);
    }
  }
});

