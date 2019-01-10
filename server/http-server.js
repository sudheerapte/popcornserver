/**
   Copyright 2018,2019 Sudheer Apte
*/

"use strict";

/*
  server.js - main HTTP server. Uses HTTP/1.1 to listen on a given port.

  Does two things:
  1. Serves assets from disk on GET requests.
     Connect to a machine as http://HOST:PORT/MACHINE
  2. Creates a TCP socket for each websocket client.
     The index.html under the MACHINE will automatically cause "boot.js"
     to be loaded, which will start a websocket upgrade.

  Usage:
  
  const httpModule = require('./http-server.js');
  const server = new httpModule(8000); // start HTTP server on port 8000
  server.on('wssocket', (socket, machine) => { ... use the socket ... });
     You can drop the socket by listening for events on it.

  Details:

  On startup, the server knows about one or more machines:
    { MACHINE1: directory1, MACHINE2: directory2, ...}

  TODO: allow external configuration of machines.

  Each client asks for one of these machines by connecting to
  http://HOST:PORT/MACHINE.

  The server goes through two states:

  1. Ready to accept new clients.
  2. Onboarding a client for MACHINE:
       - Providing common popcorn assets: index.html, boot.js.
       - Resolving assets for the MACHINE.
       - Upgrading to websocket.

  Once a client is onboarded, the server goes back to State 1.  Thus,
  it can speak websocket with multiple clients, but it can onboard
  only one client at a time. During State 2, it refuses any new
  clients.

  TODO: queue new incoming clients while one is being onboarded.

*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class Server extends EventEmitter {
  constructor(port, machines) {
    super();
    this._machines = machines;
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
    let filePath, machineDir, machine;
    if (req.url === "/boot.js") {
      filePath = this.getFilePath(null, "/boot.js");
    } else {
      machine = getFirstWord(req.url);
      if (isOneWord(req.url)) {
	const origin = req.headers["host"];
	const content = getIndexHtml(origin, machine);
	log(`sending index.html with origin ${origin} and machine ${machine}`);
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end(content);
	return;
      } else {
	log(`doGet: machine requested = ${machine}`);
	machineDir = this.getMachineDir(machine);
	log(`doGet: machine location = ${machineDir}`);
	if (! machineDir) {
	  log(`doGet: no such machine: ${machine}`);
	  log(`doGet: no such path: ${req.url}`);
	  res.writeHead(500, {'Content-Type': 'text/plain'});
	  res.end(`doGet: no such path: ${req.url}`);
	  return;
	}
	filePath = this.getFilePath(machine, getCdr(req.url));
      }
    }
    if (filePath === null) {
      log(`doGet: no such path: ${req.url}`);
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end(`doGet: no such path: ${req.url}`);
      return;
    }
    log(`doGet: looking for path ${filePath}`);
    const ctype = this.getContentType(filePath) || 'application/octet-stream';
    fs.access(filePath, fs.constants.R_OK, eMsg => {
      if (eMsg) {
	doError(eMsg);
      } else {
	res.writeHead(200, {'Content-Type': ctype });
	let str = fs.createReadStream(filePath);
	str.on('data', chunk => {
	  res.write(chunk);
	});
	str.on('end', () => {
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
    this.emit('wssocket', socket, getFirstWord(req.url));
  }

  getMachineDir(machine) {
    if (this._machines && this._machines[machine]) {
      return this._machines[machine];
    } else {
      return null;
    }
  }

  getFilePath(machine, cdr) {
    // index.html and boot.js are served from private area
    if (cdr.match(/^\/$/)) { return indexHtml(); }
    if (cdr.match(/^\/boot.js$/)) { return bootJs(); }
    const mDir = this.getMachineDir(machine);
    return path.normalize(path.join(mDir, cdr));

    function indexHtml() {
      return path.normalize(path.join(__dirname, "index.html"));
    }
    function bootJs() {
      return path.normalize(path.join(__dirname, "boot.js"));
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

function getFirstWord(urlPath) {
  const m = urlPath.match(/^\/(\w+)/);
  if (m) { return m[1]; }
  else { return null; }
}
function getCdr(urlPath) {
  const m = urlPath.match(/^\/\w+(.*)/);
  if (m) { return m[1]; }
  else { return null; }
}
function isOneWord(urlPath) {
  return !! urlPath.match(/^\/(\w+)$/);
}

function getIndexHtml(origin, machine) {
  let contents = `
<html><head>
    <meta charset="utf-8">
    <base href="http://${origin}/${machine}">
    <title>TEST</title>
    <script src="boot.js"></script>
  </head>
  <body>TEST</body>
</html>
`;
  return contents;
}

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO http-server: ${str}`);
}

module.exports = Server;
