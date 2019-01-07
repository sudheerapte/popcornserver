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

/*
  server.js - main HTTP server. Uses HTTP/1.1 to listen on a given port.

*/

const http = require('http');
const fsmodule = require('./file-server.js');
const fileServer = new fsmodule(__dirname);

class Server {
  constructor(port) {
    this._port = port;
    this._server = http.createServer( (req, res) => {
      this.handleConnect(req, res);
    });
    this._server.on('clientError', (err, sock) => {
      sock.end('HTTP/1.1 400 bad request\r\n\r\n');
    });
    this._server.listen(this._port);
  }

  handleConnect(req, res) {
    // log('got a connection');
    const ctype = fileServer.resolve('/index.html', res, msg => {
      log('resolved index.html');
      if (msg) {
	log(msg);
      } else {
	res.writeHead(200, {'Content-Type': `${ctype}`});
      }
      res.end();
    });
  }
}


function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO http-server: ${str}`);
}

module.exports = Server;
