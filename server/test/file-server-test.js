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
const fsmodule = require('../file-server.js');

let msg;

msg = "1. create fileServer";
const fileServer = new fsmodule('./assets');
fileServer || err(msg);

msg = "2. output contents of index.html";

const {Writable} = require('stream');
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
  console.log(`htmlStr error: ${msg}`);
});

 const ctype = fileServer.resolve('/index.html', htmlStr);

log(`content-type = ${ctype}`);
