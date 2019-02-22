"use strict";

const [log, err] = require('./logerr.js');
const WebsocketEmitter = require('../websocket-emitter.js');
const path = require('path');
const { PassThrough } = require('stream');
const Pipe = PassThrough;
const broker = require('../web-broker.js');
const Machine = require('../machine.js');

/** multi-step client
    returns multiple promises, to be called one after the other.

    Usage:
      Create s2c and c2s pipes (PassThrough) for server-client
      communication.

      let client = new MClient("myclient", "someurl", s2c, c2s);
      [subscribeP, handleProvideP, handleUpdateP] = client.getPromises();
      subscribeP()
        .then( handleProvideP )
        .then( handleUpdateP )
        .then( DONE )

*/
class MultiStepClient {
  constructor(clientId, url, b2c, c2b) {
    this.clientId = clientId;
    this.url = url;
    this.b2c = b2c;
    this.c2b = c2b;
  }
  getPromises() {
    this.promises =
      [ () => this.subscribeP(), () => this.handleProvideP(), () => this.handleUpdateP() ];
    return this.promises;
  }
  subscribeP() {
    return new Promise( (resolve, reject) => {
      this.wse = new WebsocketEmitter(this.b2c, this.c2b, true);
      this.wse.once('message', data => {
        this.lastReceived = data.toString();
        log(`subscribe response received: ${this.lastReceived}`);
        return resolve();
      });
      this.wse.on('ping', data => this.respondToPing(data) );
      this.wse.on('error', errMsg => err(`client read: ${errMsg}`) );
      log(`client ${this.clientId} subscribing to ${this.url}`);
      this.wse.sendMessage(`subscribe ${this.url}`, () => {});
    });
  }
  handleProvideP() {
    return new Promise( (resolve, reject) => {
      if (this.lastReceived) {
        if (this.lastReceived.startsWith('provide')) {
          this.mc = new Machine();
          const arr = this.lastReceived.split('\n');
          const result = this.mc.interpret(arr.slice(1));
          if (result) {
            return reject(`provide failed: ${result}`);
          } else {
            this.wse.once('message', data => {
              this.lastReceived = data.toString();
              log(`received: |${this.lastReceived}|`);
            });
            return resolve();
          }
        } else {
          return reject(`bad provide: ${this.lastReceived}`);
        }
      } else {
        return reject(`handleProvideP: null message received!`);
      }
    });
  }
  handleUpdateP() {
    return new Promise( (resolve, reject) => {
      if (this.lastReceived) {
        if (this.lastReceived.startsWith('update')) {
          const arr = this.lastReceived.split('\n');
          const result = this.mc.interpret(arr.slice(1));
          if (result) {
            return reject(`update failed: ${result}`);
          } else {
            log(`client interpreted update.`);
            return resolve();
          }
        } else {
          return reject(`bad update: ${this.lastReceived}`);
        }
      } else {
        return reject(`handleUpdateP: null message received!`);
      }
    });
  }
}

function trunc(logmsg) {
  if (! logmsg) { return 'null'; }
  if (typeof logmsg !== 'string') { logmsg = logmsg.toString(); }
  if (logmsg && logmsg.length > 30) {
    return logmsg.substr(0,30) + '...';
  } else {
    return logmsg;
  }
}

function provideAndUpdateTest() {
  const s2c = new Pipe();
  const c2s = new Pipe();
  const msClient = new MultiStepClient("myclient", "someurl", s2c, c2s);
  let result;
  const mc = new Machine;
  err(mc.interpret(['P .a', 'P .a/x', 'P .a/y']));
  result = broker.provide(msClient.url, mc);
  err(result);
  result = broker.addNewClient(msClient.clientId, msClient.url, c2s, s2c);
  err(result);
  log("created and added client.");
  if (broker._clientMap.size !== 1) { err(`expecting 1 client`); }
  let [subscribeP, handleProvideP, handleUpdateP] =
      msClient.getPromises();
  log(`-- starting multiStepClient`);

  subscribeP()
    .then( handleProvideP )
    .then( () => {
      mc.interpret(['C .a y']);
      log(`mc modified`);
    })
    .then( handleUpdateP )
    .then( () => {
      log(`-- done multiStepClient`);
    })
    .catch( errMsg => err(errMsg) );
}

provideAndUpdateTest();

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

