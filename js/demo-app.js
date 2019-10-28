"use strict";

const net = require('net');
const SSEmitter = require('./sse.js');
const Machine = require('./machine.js');

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('demo-app', logger);
function log(str) { logger.log(str); }

const machineLines = [
  "P .hinge/open",
  "P .hinge/closed",
  "P .bolt/unlocked",
  "P .bolt/locked",
];
const mc = new Machine();
const result = mc.interpret(machineLines);
if (result) { log(`*** bad mc: ${result} ***`); }

class DemoApp {
  start(port) {
    return new Promise((resolve, reject) => {
      this._port = port;
      this.createSock()
        .then( () => this.doConnect() )
        .then( () => this.sendProvide() )
        .then( () => this.scheduleUpdates() )
        .then( () => {
          this._sse.on('SSEvent', ev => {
            const arr = ev.data.split(/\n|\r|\r\n/);
            if (arr.length > 1) {
              log(`demoApp got command: ${arr[1]}`);
            } else {
              log(`demoApp got: ${arr[0]}`);
            }
          });
          resolve();
        })
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
      this._sse.sendMessage(`provide demo
${mc.getSerialization().join('\n')}\n\n`);
      log(`sent provide demo`);
    });
  }
  makeUpdate() {
    this.boltUnlocked = ! this.boltUnlocked;
    if (this.boltUnlocked) {
      this.hingeOpen = ! this.hingeOpen;
    }
    return [
      `C .hinge ${this.hingeOpen ? "open" : "closed"}`,
      `C .bolt ${this.boltUnlocked ? "unlocked" : "locked"}`,
    ];
  }
  doUpdate(opArr) {
    return new Promise( (resolve, reject) => {
      const result = mc.interpret(opArr);
      if (result) {
        return reject(`mc update failed: ${result}`);
      }
      this._sse.once('SSEvent', ev => {
        log(`sendUpdate got: ${ev.data}`);
        if (ev.data === "ok") {
          return resolve();
        } else {
          return reject(ev.data);
        }
      });
      this._sse.sendMessage(`update demo
${opArr.join('\n')}`);
    });
  }
  scheduleUpdates() {
    this.hingeOpen = true;
    this.boltUnlocked = true;
    setInterval( () => {
      const opArr = this.makeUpdate();
      this.doUpdate(opArr)
        .then( () => {
          log(`sent ${opArr.join(" ")}}`);
          return;
        })
        .catch( errMsg => console.log(`scheduleUpdates: ${errMsg}`) );
    }, 10000);
  }
}

module.exports = new DemoApp();

