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
  const server = new httpModule(8000);
  server.on('wssocket', (socket, machine) => { ... use the socket ... });
     You can drop the socket by listening for events on it.
  server.start();

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
const registry = require('./registry.js');
const fileUtils = require('./file-utils.js');

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
  }

  start() {
    this._server.listen(this._port);
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
    if (req.url === '/boot.js') {
      this.getBootJs(req, res, () => {
	res.end();
      });
      return;
    }
    // Otherwise it is a machine-level file:
    machine = getFirstWord(req.url);
    machineDir = registry.getMachineDir(machine);
    if (! machineDir) {
      log(`doGet: no such machine: ${machine}`);
      setContentTypeText(res);
      res.end(`doGet: no such machine: ${machine}\n`);
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
   @function(getIndexHtml) - compose the HTML using stock
   boilerplate and the "frags.html" from the machine dir.

   The stock boilerplate document contains:
   - a <base> element setting the base URL to the machine dir.
   - in the head, a <title> containing the machine name.
   - in the head, <link> elements for all the stylesheets.
   - body containing the frags.html.
 */

function getIndexHtml(req, res, machine) {
  log(`HTTP/${req.httpVersion} ${req.method} ${req.url}`);
  log(`${JSON.stringify(req.headers)}`);
  const origin = req.headers["host"];
  log(`sending index.html with origin ${origin} and machine ${machine}`);
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(`
<html>\n<head>
    <meta charset="utf-8">
    <base href="http://${origin}/${machine}">
    <title>${machine}</title>
`);
  const mDir = registry.getMachineDir(machine);
  log(`machine = ${machine} mDir = ${mDir}`);
  fileUtils.getAllCss(mDir)
    .then( cssFiles => {
      log(`found ${cssFiles.length} CSS files in ${mDir}`);
      // create <link> element for each CSS file.
      // We tried just creating relative href for the <link> elem,
      // thinking that the <base> href above would automatically
      // apply to these. But Firefox 64.0 did not use the base href.
      // So, we now use the href "MACHINE/RELATIVE" for each <link>.
      cssFiles.forEach( f => {
        f = f.substr(mDir.length+1); // relative portion
	f = machine + "/" + f;
        res.write(`    <link href="${f}" rel="stylesheet">\n`);
      });
      res.write(`    <script src="boot.js"></script>
</head>\n<body>\n`);
      const fPath = getFilePath(machine, "frags.html");
      fileUtils.streamFile(fPath, res, (errMsg) => {
        if (errMsg) {
          res.write(`<!-- frags.html not found: ${errMsg} -->\n`);
        }
    res.end(`</body></html>
`);
      });
    })
    .catch( errMsg => {
      console.log(`getIndexHtml: ${errMsg}`);
      res.end(`getIndexHtml: ${errMsg}\n</body></html>\n`);
    });
}

function log(str) {
  if (! process.env["DEBUG"]) { return; }
  const d = new Date();
  console.log(`[${d.toISOString()}] INFO http-server: ${str}`);
}

module.exports = Server;
