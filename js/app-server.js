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
  app-server.js - allow apps to connect and provide machines

  Listens on a given TCP port or UNIX port, for apps to connect and
  provide machines and updates. These machines and updates are sent
  along to the broker, which shares them with any HTTP clients.

  Usage: this module returns a singleton object.

  To start listening, call startListening() with an options object:

  {port: 8001} means listen on TCP port 8001.
  {path: "/tmp/appServer"} means listen on that UNIX socket.

  startListening() returns a promise that resolves when the
  server has started listening.

  Then subscribe to these events:

  'provide' (name, machine) - a new machine named "name" is being provided.
  'update' (name, array) - the machine named "name" is being updated.
  'abandon' (name) - a machine is being abandoned.
  'app' (name) - an command app is being registered for a machine.

  To send a command to an app, just call sendCommand(name, command).
  The name is the name of a machine, and "command" is a string.

*/

const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');
const SSEventEmitter = require('./sse.js');
const wrangler = require('./client-wrangler.js');
const Machine = require('./machine.js');

class AppServer extends EventEmitter {
  constructor() {
    super();
    this._map = new Map(); // machine -> record.
    // record.mc is the latest machine.
    // if record.sse exists, then it is an appConnect record,
    //   and you can send commands to the app.
  }
  startListening(options) {
    return new Promise( (resolve, reject) => {
      this.options = options;
      const port = this.options.port;
      const uPath = this.options.path;
      if (port) {
	this.server = net.createServer( c => this.listener(c) );
	this.server.listen(port, () => {
	  log(`AppServer listening on port ${port}`);
	  resolve();
	});
	this.server.on('error', reject);
      } else if (uPath) {
	this.server = net.createServer( c => this.listener(c) );
	this.server.listen(uPath, () => {
	  log(`AppServer listening on socket ${uPath}`);
	  resolve();
	});
	this.server.on('error', reject);
      } else {
	return reject(`AppServer cannot start listening.`);
      }
      wrangler.on('appConnect', rec => this.handleAppConnect(rec) );
      wrangler.on('oneShotCommand', rec => this.handleOneShotCommand(rec) );
      wrangler.on('fireAndForget', data => this.handleFireAndForget(data) );
    });
  }
  listener(c) {
    log(`client connected; existing map size = ${this._map.size}`);
    const emitter = wrangler.newClient(c);
  }
  handleAppConnect(rec) {
    if (typeof rec.lines !== 'string') {
      return die(`appConnect: bad rec.lines: ${typeof rec.lines}`);
    }
    const arr = rec.lines.split(/\n|\r\n|\r/);
    if (! arr) {
      return die(`appConnect: bad payload`);
    }
    const m = arr[0].match(/^\s*machine\s+(\w+)/);
    if (! m) {
      return die(`appConnect: bad command: |${arr[0]}|`);
    }
    const machine = m[1];
    const mc = new Machine();
    const result = mc.interpret(arr.slice(1));
    if (result) {
      return die(`bad machine ${machine}: ${result}`);
    }
    rec.sse.sendMessage("ok");
    log(`providing machine ${machine}`);
    this._map.set(machine, {mc: mc, sse: rec.sse});
    rec.sse.on('disconnect', sse => {
      log(`deleting provider for machine ${machine}`);
      this._map.delete(machine);
    });
    this.emit('provide', machine, mc);

    function die(msg) {
      log(`${msg}. Dropping connection`);
      rec.sse.sendMessage(`error: ${msg}`);
      rec.dropConnection();
    }
    function warn(msg) {
      log(`sending message to client: |${msg}|`);
      rec.sse.sendMessage(`${msg}`);
    }
  }
  handleOneShotCommand(rec) {
    if (typeof rec.lines !== 'string') {
      return die(`oneShotCommand: bad rec.lines: ${typeof rec.lines}`);
    }
    const arr = rec.lines.split(/\n|\r\n|\r/);
    if (! arr) {
      return die(`oneShotCommand: bad payload`);
    }
    const m = arr[0].match(/^\s*machine\s+(\w+)/);
    if (! m) {
      return die(`oneShotCommand: bad command: |${arr[0]}|`);
    }
    const machine = m[1];
    const mc = new Machine();
    const result = mc.interpret(arr.slice(1));
    if (result) {
      return die(`bad machine ${machine}: ${result}`);
    }
    rec.sendSuccess("ok", (errMsg) => {
      if (errMsg) {
	log(`oneShotCommand ok reply did not go through: ${errMsg}`);
      }
    });
    log(`providing machine ${machine}`);
    this._map.set(machine, {mc: mc});
    this.emit('provide', machine, mc);

    function die(msg) {
      log(`oneShotCommand machine error: ${msg}`);
      rec.sendError(`Error: ${msg}`, (errMsg) => {
	if (errMsg) {
	  log(`oneShotCommand error reply "${msg}" did not go through:
|${errMsg}|`);
	}
      });
    }
  }
  handleFireAndForget(data) {
    if (typeof data !== 'string') {
      return die(`fireAndForget: bad data: ${typeof data}`);
    }
    const arr = data.split(/\n|\r\n|\r/);
    if (! arr) {
      return die(`fireAndForget: bad payload`);
    }
    const m = arr[0].match(/^\s*machine\s+(\w+)/);
    if (! m) {
      return die(`fireAndForget: bad command: |${arr[0]}|`);
    }
    const machine = m[1];
    const mc = new Machine();
    const result = mc.interpret(arr.slice(1));
    if (result) {
      return die(`bad machine ${machine}: ${result}`);
    }
    log(`providing machine ${machine}`);
    this._map.set(machine, {mc: mc});
    this.emit('provide', machine, mc);

    function die(msg) {
      log(`${msg}`);
    }
  }
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('app-server', logger);
function log(str) { logger.log(str); }

module.exports = new AppServer();
