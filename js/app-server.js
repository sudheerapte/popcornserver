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
  along to the web broker, which shares them with any HTTP clients.

  Usage: this module returns a singleton object.

  To start listening, call startListening() with an options object:

  {port: 8001} means listen on TCP port 8001.
  {path: "/tmp/appServer"} means listen on that UNIX socket.

  startListening() returns a promise that resolves when the
  server has started listening.

  Then subscribe to these events:

  'provide' (app, name, machine)

     A new machine named "name" is being provided by an app "app". If
     "app" is "Drive-By", then the app did not connect.

     You should watch for updates to the machine by calling
     machine.addBlockListener().

  'abandon' (app, name, machine)

     A machine is being abandoned by app.  You should call
     machine.removeBlockListener().

  To send a command to an app, just call sendCommand(app, name, command).
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
    this._map = new Map(); // machine -> { mc, sse }
    this._appMap = new Map(); // appName -> array of machine names
    this._appMap.set("Drive-By", []);
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
    const emitter = wrangler.newClient(c);
    // no need to keep emitter; it is also passed in with "rec"
  }
  handleAppConnect(rec) {
    this.handleAppName(rec) // which also registers handleAppMessage
      .then( appName => rec.sse.sendMessage("ok") )
      .catch( errMsg => {
        log(`handleAppConnect: ${errMsg}. Dropping connection.`);
        rec.sse.sendMessage(errMsg);
        rec.dropConnection();
      });
  }
  handleAppName(rec) {
    return new Promise( (resolve, reject) => {
      if (typeof rec.lines !== 'string') {
        return reject(`appConnect: bad rec.lines: ${typeof rec.lines}`);
      }
      const arr = rec.lines.split(/\n|\r\n|\r/);
      if (! arr || arr.length <= 0) {
        return reject(`appConnect: bad payload`);
      }
      const m = arr[0].match(/^\s*(\w+)/);
      if (!m) {
        return reject(`appConnect: bad payload`);
      }
      const appName = m[1];
      if (this._appMap.has(appName)) {
        log(`appConnect: already has ${appName}`);
      } else {
        this._appMap.set(appName, []);
        log(`appConnect: registered ${appName}`);
      }
      rec.sse.on('SSEvent', ev => {
        this.handleAppMessage(appName, rec, ev)
          .then( () => rec.sse.sendMessage("ok") )
          .catch( errMsg => {
            log(`${appName}: ${errMsg}`);
            rec.sse.sendMessage(errMsg);
          });
      });
      return resolve(appName);
    });
  }
  handleAppMessage(appName, rec, ev) {
    return new Promise( (resolve, reject) => {
      if (typeof ev.data !== 'string') {
        return reject(`provide: bad payload type: ${typeof ev.data}`);
      }
      if (ev.data.match(/^\s*$/)) { return resolve(); }
      const m = ev.data.match(/^\s*(\w+)\s+(\w+)/);
      if (!m) {
        return reject(`app ${appName}: bad command: |${ev.data}|`);
      }
      const machine = m[2];
      if (m[1] === "provide") {
        log(`provide message received for machine ${machine}`);
        return this.doProvide(appName, machine, rec.sse, ev.data,
                              resolve, reject);
      } else if (m[1] === "abandon") {
        return this.doAbandon(appName, machine, rec.sse, ev.data,
                              resolve, reject);
      } else if (m[1] === "update") {
        return this.doUpdate(appName, machine, rec.sse, ev.data,
                             resolve, reject);
      } else {
        return reject(`unknown transaction: ${m[1]}`);
      }
    });
  }
  doProvide(appName, machine, sse, payload, resolve, reject) {
    log(`provide ${machine}: parsing transaction`);
    const arr = payload.split(/\n|\r\n|\r/);
    if (! arr || arr.length <= 1) {
      return reject(`provide: bad payload`);
    }
    const m = arr[0].match(/^\s*provide\s+(\w+)/);
    if (!m) {
      log(`provide: bad syntax: |${arr[0]}|`);
      return reject(`provide: bad syntax: |${arr[0]}|`);
    }
    const mc = new Machine();
    const res = mc.interpret(arr.slice(1));
    log(`provide: mc = |${mc.getSerialization().join(" ")}|`);
    if (res) {
      return reject(`provide ${machine}: ${res}`);
    }
    log(`this._appMap = ${this._appMap.size}`);
    if (this._appMap.get(appName).includes(machine)) {
      const msg = `provide ${machine}: ${appName} already provides ${machine}`;
      log(msg);
      return resolve();
    }
    log(`providing machine ${machine}`);
    this._map.set(machine, {mc: mc, sse: sse});
    this._appMap.get(appName).push(machine);
    this.emit('provide', appName, machine, mc);
    return resolve();
  }
  doAbandon(appName, machine, sse, payload, resolve, reject) {
    log(`abandon ${machine}: parsing transaction`);
    if (! this._appMap.has(appName)) {
      return reject(`app ${appName} not found!`);
      return reject(`app ${appName} not found!`);
    }
    const appEntry = this._appMap.get(appName);
    if (! appEntry.includes(machine)) {
      return reject(`app ${appName} has no machine ${machine}`);
    }
    const pos = appEntry.findIndex( x => x === machine);
    appEntry.splice(pos, 1);
    log(`abandon: removed machine ${pos}. Left now: ${appEntry.length}`);
    this.emit('abandon', appName, machine);
    return resolve();
  }
  doUpdate(appName, machine, sse, payload, resolve, reject) {
    log(`doUpdate ${appName} ${machine}`);
    if (! this._map.has(machine)) {
      log(`update: no such machine: ${machine}`);
      return reject(`update: no such machine: ${machine}`);
    }
    const arr = payload.split(/\n|\r\n|\r/);
    if (! arr || arr.length <= 1) {
      return reject(`update: bad payload`);
    }
    log(`update = |${arr.slice(1).join(" ")}|`);
    const mc = this._map.get(machine).mc;
    const res = mc.interpret(arr.slice(1));
    if (res) {
      log(`update: ${res}`);
      return reject(`update: ${res}`);
    } else {
      log(`update ${machine} succeeded`);
      return resolve();
    }
  }
  doCommand(machine, clientId, arr) {
    if (this._map.has(machine)) {
      const rec = this._map.get(machine);
      if (rec.sse) {
        log(`doCommand: sending to app: ${arr[0]}`);
        rec.sse.sendMessage(`command ${machine} ${clientId}
${arr.join("\n")}`);
      } else {
        log(`doCommand: rec.sse does not exist}. ${arr[0]}`);
      }
    } else {
      log(`doCommand: _map has no machine: ${machine}. ${arr[0]}`);
    }
  }

  // ------------------- handleOneShotCommand and friends
  handleOneShotCommand(rec) {
    if (typeof rec.lines !== 'string') {
      const msg = `bad command: ${typeof rec.lines}`;
      return rec.sendError(msg, () => log(msg) );
    }
    const arr = rec.lines.split(/\n|\r\n|\r/);
    if (! arr || arr.length <= 0) {
      const msg = `bad command: ${typeof rec.lines}`;
      return rec.sendError(msg, () => log(msg) );
    }
    const m = arr[0].match(/^\s*(\w+)/);
    if (!m) {
      const msg = `bad command: ${arr[0]}`;
      return rec.sendError(msg, () => log(msg) );
    }
    const cmd = m[1];
    if (/^update$/.test(cmd)) {
      const m = arr[0].match(/^\s*(\w+)\s+(\w+)\s*$/);
      if (! m) {
        const msg = `bad update command: ${arr[0]}`;
        return rec.sendError(msg, () => log(msg) );
      }
      const machine = m[2];
      this.processUpdate(machine, arr.slice(1))
        .then(() => {
          rec.sendSuccess('ok', () => {});
          this.emit('update', 'Drive-By', machine, arr.slice(1));
        })
        .catch( errMsg => {
          rec.sendError(errMsg, () => log(errMsg) );
        });
    } else if (/^provide$/.test(cmd)) {
      const m = arr[0].match(/^\s*(\w+)\s+(\w+)\s*$/);
      if (! m) {
        const msg = `bad provide command: ${arr[0]}`;
        return rec.sendError(msg, () => log(msg) );
      }
      const machine = m[2];
      this.processProvide(machine, arr.slice(1))
        .then(() => {
          rec.sendSuccess('ok', () => {});
          log(`emitting provide Drive-By ${machine}`);
          this.emit('provide', 'Drive-By', machine, this._map.get(machine).mc);
        })
        .catch( errMsg => {
          rec.sendError(errMsg, () => log(errMsg) );
        });
    } else {
      const msg = (`bad command: ${cmd}`);
      return rec.sendError(msg, () => log(msg) );
    }
  }    
  processProvide(machine, arr) {
    return new Promise((resolve,reject) => {
      if (! arr.length > 0) {
        return reject(`provide ${machine}: no payload!`);
      }
      if (this._map.has(machine)) {
        log(`already have ${machine}. Replacing.`);
        this._map.set(machine, {mc: mc})
        return resolve();
      }
      const mc = new Machine;
      const result = mc.interpret(arr);
      if (result) {
        return reject(`provide failed: ${result}`);
      } else {
        log(`machine ${machine} interpret result OK`);
        this._map.set(machine, {mc: mc})
        return resolve();
      }
    });
  }
  processClientProvide(machine, clientId, arr) {
    log(`processing clientProvide ${clientId} ${machine}`);
    this.processProvide(machine, arr)
      .then( () => {
        log(`emitting provide Drive-By ${machine}`);
        this.emit('provide', 'Drive-By', machine, this._map.get(machine).mc);
      })
      .catch( errMsg => {
        log(`client provided ${machine}: ${errMsg}. Not registered.`);
      });
  }
  processUpdate(machine, arr) {
    return new Promise((resolve,reject) => {
      if (! arr.length > 0) {
        return reject(`update: no payload!`);
      }
      const mc = this._map.get(machine).mc;
      if (!mc) {
        return reject(`update: no such machine: ${machine}`);
      }
      const result = mc.interpret(arr);
      if (result) {
        return reject(`update failed: ${result}`);
      } else {
        return resolve();
      }
    });
  }

  handleFireAndForget(data) {
    log(`TODO fire-and-forget not implemented.`);
  }

  stopListeningP() {
    log(`stopping...`);
    return new Promise( (resolve, reject) => {
      this.server.close( (arg) => {
        if (arg) { // server was not listening
          log(`close: server was not listening`);
          return reject(arg);
        } else {
          log(`stopped`);
          return resolve();
        }
      });
    });
  }
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('app-server', logger);
function log(str) { logger.log(str); }

module.exports = new AppServer();
