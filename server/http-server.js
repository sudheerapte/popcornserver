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

  Does two things:
  1. Serves assets from disk on GET requests.
  2. Creates a TCP socket for each websocket client.

  Usage:
  
  const httpModule = require('./http-server.js');
  const server = new httpModule(8000); // start HTTP server on port 8000
  server.on('wssocket', (socket) => { ... use the socket ... });
     You can drop the socket by listening for events on it.
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class Server extends EventEmitter {
  constructor(port) {
    super();
    this._port = port;
    this._server = http.createServer( (req, res) => {
      this.handleConnect(req, res);
    });
    this._server.on('clientError', (err, sock) => {
      sock.end('HTTP/1.1 400 bad request\r\n\r\n');
    });
    this._server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
    this._server.listen(this._port);
  }

  handleConnect(req, res) {
    log(`HTTP/${req.httpVersion} ${req.method} ${req.url}`);
    log(`${JSON.stringify(req.headers)}`);
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
    let p = this.getFilePath(req.url);
    if (p === null) {
      log(`doGet: no such path: ${req.url}`);
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end(`doGet: no such path: ${req.url}`);
      return;
    }
    const ctype = this.getContentType(p) || 'application/octet-stream';
    fs.access(p, fs.constants.R_OK, eMsg => {
      if (eMsg) {
	doError(eMsg);
      } else {
	res.writeHead(200, {'Content-Type': ctype });
	let str = fs.createReadStream(p);
	str.on('data', chunk => {
	  res.write(chunk);
	});
	str.on('end', () => {
          // res.end('\r\n');
	  res.end();
	});
	str.on('error', msg => {
	  doError(msg);
	});
      }
    });

    function doError(msg) {
      log(msg);
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end(msg);
    }
  }

  handleUpgrade(req, socket, head) {
    log(`upgrade received: ${req.method} ${req.url}`);
    // log(`headers: ${JSON.stringify(req.headers)}`);
    const origin = req.headers["origin"];
    let key = req.headers["sec-websocket-key"];
    const MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    log(`upgrade origin = ${origin}; key = ${key}`);
    key = require('crypto').createHash('sha1').update(key+MAGIC).digest('base64');
    socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
		 'Upgrade: WebSocket\r\n' +
		 'Sec-Websocket-Accept: ' + key + '\r\n' +
		 'Connection: Upgrade\r\n' +
		 '\r\n');
    this.emit('wssocket', socket);
    // socket.on('data', (data) => { console.log(`got ws data: ${data}`); });
  }

  getFilePath(urlPath) {
    if (urlPath.match(/^\/$/)) { return svrFile("index.html"); }
    if (urlPath.match(/^\/boot.js$/)) { return svrFile("boot.js"); }
    return null;

    function svrFile(name) {
      const svrP = path.normalize(path.join(__dirname, name));
      return svrP;
    }
  }

  getContentType(fileName) {
    const ContentType = {
      //  file extension to Content-Type
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    };
    return ContentType[path.extname(fileName)];
  }

}


function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO http-server: ${str}`);
}

module.exports = Server;
