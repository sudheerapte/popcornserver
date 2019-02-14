"use strict";

const net = require('net');
const SSEmitter = require('./sse.js');
const Machine = require('./machine.js');

const machineLines = [
  "P .hinge/open",
  "P .hinge/closed",
  "P .bolt/unlocked",
  "P .bolt/locked",
];

class DemoApp {
  start(port) {
    return new Promise((resolve, reject) => {
      this._port = port;
      this.createSock()
        .then( () => this.doConnect() )
        .then( () => this.sendProvide() )
        .then( () => this.scheduleUpdates() )
        .then( resolve )
        .catch( reject );
    });
  }
  createSock() {
    log(`--- creating sock`);
    return new Promise( (resolve, reject) => {
      this._sock = net.createConnection({port:this._port}, () => {
        resolve();
      });
    });
  }
  doConnect() {
    log(`--- connecting`);
    return new Promise( (resolve, reject) => {
      this._sock.on('error', errMsg => log(`demoApp got error: ${errMsg}`) );
      this._sock.on('end', () => {
        log(`demoApp got dropped.`);
        this._sock.end();
      });
      this._sse = new SSEmitter();
      this._sse.setWriteStream(this._sock);
      this._sse.readFrom(this._sock);
      this._sse.once('SSEvent', ev => {
        log(`doConnect got: |${ev.data}|`);
        if (ev.data === "ok") {
          return resolve();
        } else {
          return reject(`doConnect got back |${ev.data}|`);
        }
      });
    this._sock.write(`event: appConnect
data: demoApp\n\n`);
    });
  }
  sendProvide() {
    return new Promise( (resolve, reject) => {
      this._sse.once('SSEvent', ev => {
        log(`sendProvide got: |${ev.data}|`);
        if(ev.data === "ok") {
	  resolve();
        } else {
          reject(ev.data);
        }
      });
      const mc = new Machine();
      const result = mc.interpret(machineLines);
      if (result) { log(`*** bad mc: ${result} ***`); }
      this._sse.sendMessage(`provide demo
${mc.getSerialization().join('\n')}\n\n`);
      log(`sent provide demo`);
    });
  }
  sendUpdate(hingeOpen, boltUnlocked) {
    return new Promise( (resolve, reject) => {
      this._sse.once('SSEvent', ev => {
        log(`sendUpdate got: ${ev.data}`);
        if (ev.data === "ok") {
          return resolve();
        } else {
          return reject(ev.data);
        }
      });
      this._sse.sendMessage(`update demo
C .hinge ${hingeOpen ? "open" : "closed"}
C .bolt ${boltUnlocked ? "unlocked" : "locked"}`);
    });
  }
  scheduleUpdates() {
    return new Promise( (resolve, reject) => {
      this.hingeOpen = true;
      this.boltUnlocked = true;
      setInterval( () => {
        this.boltUnlocked = ! this.boltUnlocked;
        if (this.boltUnlocked) {
          this.hingeOpen = ! this.hingeOpen;
        }
        this.sendUpdate(this.hingeOpen, this.boltUnlocked)
          .then( () => {
            log(`sent hingeOpen = ${this.hingeOpen} boltUnlocked = ${this.boltUnlocked}`);
            return resolve();
          })
          .catch( reject );
      }, 2000);
    });
  }
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('demo-app', logger);
function log(str) { logger.log(str); }

module.exports = new DemoApp();
