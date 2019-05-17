/**
   Copyright 2018,2019 Sudheer Apte
*/

"use strict";

/*
  server.js - main HTTP server. Uses HTTP/1.1 to listen on a given port.

  The UA should request a machine as:

         http://HOST:PORT/MACHINE

  We find the assets dir of the machine as configured in options.json.
  Then we serve an index.html that combines the "frags.html" and any
  "head-frags.html", with a Javascript program boot.js.

  The boot.js opens a websocket back to the same server, with the URL:

        ws://HOST:PORT/MACHINE

  and as the first command, sends a "subscribe MACHINE".

  As soon as the websocket upgrade is received, we accept it and then
  emit a 'wssocket' event containing the socket and the client details.

  Usage:
  
  const httpModule = require('./http-server.js');
  const server = new httpModule({port: 8000}); // default localhost:8000
  server.on('wssocket', (socket, rec) => { ... use the socket ... });
     "rec" = { origin, key, url }.
     The event handler can drop the socket when done.

  server.start();

*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const registry = require('./registry.js');
const fileUtils = require('./file-utils.js');


class Server extends EventEmitter {
  constructor(options) {
    super();
    this._host = options.host || "localhost";
    this._port = options.port || "8000";
    this._server = http.createServer( (req, res) => {
      this.handleConnect(req, res);
    });
    this._server.on('clientError', (err, sock) => {
      sock.end('HTTP/1.1 400 bad request\r\n\r\n');
    });
    this._server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  start() {
    log(`listening on ${this._host}:${this._port}`);
    this._server.listen({host: this._host, port: this._port});
  }

  handleConnect(req, res) {
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
    // /boot.js is common, popcorn-level code.
    if (req.url.match(/\/boot\.js$/)) {
      this.getBootJs(req, res, () => {
	res.end();
      });
      return;
    }
    // Otherwise it is a machine-level file:
    machine = getFirstWord(req.url);
    log(`doGet: url = |${req.url}| first word = ${machine}`);
    machineDir = registry.getMachineDir(machine);
    if (! machineDir) {
      log(`doGet: no such machine: ${machine}`);
      setContentTypeText(res);
      res.end(`no such machine: ${machine}\n`);
      return;
    }
    if (isOneWord(req.url)) {
      getIndexHtml(req, res, machine); // async
      return;
    }
    filePath = getFilePath(machine, getCdr(req.url));
    if (filePath === null) {
      log(`doGet: no such path: ${req.url}`);
      setContentTypeText(res);
      res.end(`doGet: no such path: ${req.url}`);
      return;
    }
    const ctype = getContentType(filePath) || 'application/octet-stream';
    fs.access(filePath, fs.constants.R_OK, eMsg => {
      if (eMsg) {
	doError(res, eMsg);
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
	  doError(res, msg);
	});
      }
    });
  }    

  /**
     @function(getBootJs) - concatenate machine.js and boot.js

     The machine.js file contains "module.exports", so we first
     neutralize it by providing a dummy var up front.
   */
  getBootJs(req, res, cb) {
    const machineJsPath = path.join(__dirname, "machine.js");
    const bootJsPath = path.join(__dirname, "boot.js");
    res.writeHead(200, {'Content-Type': 'application/javascript'});
    res.write("var module = {};\n");
    fileUtils.streamFile(machineJsPath, res, (errMsg) => {
      if (errMsg) {
	doError(res, `machine.js: ${errMsg}`);
	cb();
      } else {
	fileUtils.streamFile(bootJsPath, res, (errMsg) => {
	  if (errMsg) {
	    doError(res, `boot.js: ${errMsg}`);
	    cb();
	  } else {
	    cb();
	  }
	});
      }
    });
  }

  handleUpgrade(req, socket, head) {
    log(`upgrade received: ${req.method} ${req.url}`);
    const origin = req.headers["origin"];
    let key = req.headers["sec-websocket-key"];
    const MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    log(`upgrade origin = ${origin}; key = ${key}`);
    let rkey = require('crypto').createHash('sha1').update(key+MAGIC).digest('base64');
    socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
		 'Upgrade: WebSocket\r\n' +
		 'Sec-Websocket-Accept: ' + rkey + '\r\n' +
		 'Connection: Upgrade\r\n' +
		 '\r\n');
    this.emit('wssocket', socket,
	      { origin: req.headers["origin"],
		key: key,
		url: req.url });
  }
}

function setContentTypeText(res) {
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
}

function doError(res, msg) {
  log(`doError: ${msg}`);
  setContentTypeText(res);
  res.end(`Error: ${msg}`);
}

function getFilePath(machine, cdr) {
  const mDir = registry.getMachineDir(machine);
  return path.normalize(path.join(mDir, cdr));
}


function getContentType(fileName) {
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

/**
   @function(getIndexHtml) - return "MACHINE-index.html" from the
   machine dir, with two additions:

   - a <base> element setting the base URL to the machine dir.
   - a <script> element for boot.js.
 */

function getIndexHtml(req, res, machine) {
  sendIndexWithReplacement(req, res, machine)
    .then( () => log(`sent index.html`) )
    .catch( errMsg => log(`failed sending index.html: ${errMsg}`) );
}

function sendIndexWithReplacement(req, res, machine) {
  return new Promise( (resolve, reject) => {
    log(`HTTP/${req.httpVersion} ${req.method} ${req.url}`);
    log(`${JSON.stringify(req.headers)}`);
    const origin = req.headers["host"];
    log(`sending ${machine}-index.html with origin ${origin}`);
    res.writeHead(200, {'Content-Type': 'text/html'});
    const mDir = registry.getMachineDir(machine);
    log(`machine = ${machine} mDir = ${mDir}`);
    const hfPath = getFilePath(machine, `${machine}-index.html`);
    let indexContents;
    try {
      // We had to read this file synchronously, because
      // the try-catch-finally method was not working with streaming.
      indexContents = fs.readFileSync(hfPath, {encoding: 'utf8'});
      const ic1 = indexContents.replace(/\<\s*head.*\>/,
                                  `<head>
    <base href="http://${origin}/${machine}/">`);
      const ic2 = ic1.replace(/\<\s*\/\s*head\s*\>/,
                              `    <script src="boot.js"></script></head>`);
      const ic3 = ic2.replace(/\<\s*body\s*/,
                              `<body hidden="" `);
      res.write(ic3);
      log(`${machine}-index.html sent`);
    } catch( e ) {
      res.write(`<!-- ${machine}-index.html not found: ${e.code} -->\n`);
      log(`${machine}-index.html missing comment sent`);
    }
    res.end();
    return resolve();
  });
}  

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('http-server', logger);
function log(str) { logger.log(str); }

module.exports = Server;


// --------------------
function hideBody() {
  return new Promise( (resolve, reject) => {
    const bodyElem = document.querySelector('body');
    if (bodyElem) {
      // prevent flashing until machine is loaded
      bodyElem.setAttribute("hidden", "");
      return resolve();
    } else {
      reject(`failed to find bodyElem!`);
    }
  });
}

// not a promise

