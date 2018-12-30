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

msg = "1. create fileServer --------";
log(msg);
const fileServer = new fsmodule('./assets');
fileServer || err(msg);

msg = "2. count contents of index.html ----------";
log(msg);
let countBytes = 0; // bytes in the contents of index.html
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
const ctype = fileServer.resolve('/index.html', htmlStr);
ctype === "text/html" || err(`index.html Content-Type should be text/html: found ${ctype}`);

msg = "3. content-type of example.svg ----------";
log(msg);
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
const svgtype = fileServer.resolve('/example.svg', svgStr);
svgtype === "image/svg+xml" || err(`example.svg type = ${svgtype}`);


