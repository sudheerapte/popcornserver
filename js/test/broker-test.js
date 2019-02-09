"use strict";

const [log, err] = require('./logerr.js');
const WebsocketEmitter = require('../websocket-emitter.js');
const path = require('path');
const { PassThrough } = require('stream');
const Pipe = PassThrough;
const broker = require('../broker.js');
const Machine = require('../machine.js');

class Client {
  constructor(clientId, url, b2c, c2b, resolve, reject) {
    this.clientId = clientId;
    this.url = url;
    this.b2c = b2c;
    this.c2b = c2b;
    this.resolve = resolve;
    this.reject = reject;
    this.wse = new WebsocketEmitter(b2c, c2b, true);
    this.wse.on('message', data => this.handleMessage(data) );
    this.wse.on('ping', data => this.respondToPing(data) );
    this.wse.on('error', errMsg => err(`client read: ${errMsg}`) );
    setImmediate( () => {
      const result = this.wse.sendMessage(`subscribe ${url}`, () => {
	//log(`sendMessage cb successful`);
      });
      if (! result) {
	log(`sendMessage returned ${result}!`);
	err(result);
      }
    });
  }
  respondToPing(payload) {
    // log(`client got ping |${payload}|. Sending pong...`);
    this.wse.sendPong(payload, () => { /* log("pong sent."); */});
  }
  handleMessage(data) {
    // log(`client got message: |${trunc(data)}|`);
    if (data.toString().match(/^machine/)) {
      this.resolve();
    } else {
      // log(`client: subscribe failed.`);
      this.reject("not ok");
    }
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

function subscribeFailTest() {
  return new Promise( (resolve, reject) => {
    let msg1 = "--- subscribeFailTest";
    log(msg1);
    let c2b, b2c;
    c2b = new Pipe(); b2c = new Pipe();
    const client = new Client("foo", "someurl", b2c, c2b, reject, resolve);
    // log(`client foo created.`);
    const result = broker.addNewClient(client.clientId, client.url, c2b, b2c);
    err(result);
    // log("created and added client.");
  });
}
function subscribeSucceedTest() {
  return new Promise( (resolve, reject) => {
    let msg1 = "--- subscribeSucceedTest";
    log(msg1);
    let c2b, b2c, result, machine;
    machine = new Machine();
    result = machine.interpret(['P .a', 'P .b']);
    if (result) { log(`interpret result = ${result}`); err(! result); }
    // log(`machine = ${machine.getSerialization().join(' ')}`);
    result = broker.provide("someurl", machine);
    err(result);
    c2b = new Pipe(); b2c = new Pipe();
    const client = new Client("bar", "someurl", b2c, c2b, resolve, reject);
    result = broker.addNewClient(client.clientId, client.url, c2b, b2c);
    err(result);
    // log("created and added client.");
  });
}

subscribeFailTest()
  .then( subscribeSucceedTest )
  .then( () => {
    // log(`ending test.`);
    process.exit(0);
  })
  .catch( errMsg => err(errMsg) );

// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

