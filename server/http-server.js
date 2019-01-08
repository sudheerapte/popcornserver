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
const fs = require('fs');
const path = require('path');

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
    log(`method = ${req.method}`);
    if (req.method === 'GET') {
      req.on('data', chunk => log(`httpServer: received ${chunk.length} bytes`));
      req.on('error', msg => {
	log(`httpServer: received error: ${msg}`);
	res.end();
      });
      req.on('end', () => this.doGet(req, res));
    } else {
      log(`httpServer: method ${req.method} not supported`);
      res.end();
    }
  }

  doGet(req, res) {
    let p = path.normalize(path.join(__dirname, "index.html"));
    fs.access(p, fs.constants.R_OK, eMsg => {
      if (eMsg) {
	log(`doGet: ${eMsg.code}`);
	res.writeHead(500, {'Content-Type': 'text/html'});
	res.end(`doGet: ${eMsg.code}\r\n\r\n`);
      } else {
	res.writeHead(200, {'Content-Type': 'text/html'});
	let str = fs.createReadStream(p);
	str.on('data', chunk => {
	  res.write(chunk);
	});
	str.on('end', () => {
	  // log(`readStream ended.`);
	  res.end('\r\n');
	});
	str.on('error', msg => {
	  res.writeHead(500, {'Content-Type': 'text/html'});
	  res.end(`doGet: ${eMsg.code}\r\n\r\n`);
	});
      }
    });
  }
}


function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO http-server: ${str}`);
}

module.exports = Server;
