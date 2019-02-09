"use strict";

/**
   @module(broker.js) - singleton - manage web clients and apps.

   When a client connects, we start tracking it by clientId.
      addNewClient()

   When a client subscribes to a machine, we check if it is
   available and return it, then keep sending it any updates.
      subscribe()

   When an app provides a machine, we add it to the map of available
   machines. For all the clients subscribed to that machine, we
   send them the machine start sending them updates.
      provide()

   Usage:

   const broker = require('./broker.js');
   broker.start(); // now listening on TCP port options.appPort

   ... TODO when new app connects...
   ... TODO broker automatically adds app and gets machines ...

   ... on new HTTP websocket client, you call addNewClient() ...
   broker.addNewClient(sock, clientId);
   ... broker sends the client its machine ...
   ... TODO broker connects app and client ...
   // client will automatically be dropped when it disconnects
   

*/

const WebsocketEmitter = require('./websocket-emitter.js');
const EventEmitter = require('events');

class Broker extends EventEmitter {
  constructor() {
    super();
    this._clientMap = new Map(); // clientId -> { url, wse, machines }
    this._machineMap = new Map(); // machine name -> machine object
  }
  addNewClient(clientId, url, readStr, writeStr) {
    log(`new client ${clientId} url ${url}`);
    const wse = new WebsocketEmitter(readStr, writeStr);
    const rec = {url: url, wse: wse, machines: []};
    this._clientMap.set(clientId, rec);
    wse.on('message', data => {
      this.handleMessage(clientId, data)
	.then(() => log(`handleMessage done`) )
	.catch(errMsg => {
	  log(`handleMessage: ${errMsg}`);
	  if (! wse.sendMessage(`error: ${errMsg}`, () => {})) {
	    log(`error message failed to send: ${errMsg}`);
	  }
	});
    });
    wse.on('pong', text => {
      log(`   -- got pong ${text}. Closing websocket.`);
      wse.sendClose(1000, 'done with test.', () => {
	log(`close frame sent.`);
      });
    });
    wse.on('close', (code, reason) => {
      log(`got close code ${code}.`);
      this._clientMap.delete(clientId);
    });
    readStr.on('close', () => {
      log(`readStr closed: ${machine} ${clientId}`);
      this._clientMap.delete(readStr);
    });
    let machine = url;
    if (machine.startsWith('/')) { machine = url.substr(1); }
    this.handleMessage(clientId, `subscribe ${machine}`)
      .then( () => log(`subscribe done`) )
      .catch( errMsg => {
	log(`subscribe failed: ${errMsg}`);
	this.sendMessage(`error: ${errMsg}`)
	  .then(() => log(`error sent to client`) )
	  .catch(fail =>
		 console.log(`error failed to send to client: ${fail}`));
      });
    this.emit('newclient', clientId);
  }
  /**
     handleMessage: do the entire sequence for this message.
       subscribe: send the machine if available, else send error.
       any other command: send error.

     This method returns a promise that usually resolves.
     It rejects only if there is a bug or internal error.
   */
  handleMessage(clientId, data) {
    return new Promise( (resolve, reject) => {
      log(`client ${clientId}: |${data}|`);
      if (data.match(/^\s*subscribe\s+/)) {
	const m = data.match(/subscribe\s+(\w+)/);
	if (m) {
	  let machine = m[1];
	  this.subscribe(clientId, machine)
	    .then( () => {
	      log(`subscribed ${clientId} to machine ${machine}`);
	      resolve();
	    })
	    .catch( errMsg => {
	      const fullMsg = `error: ${errMsg}`;
	      log(fullMsg);
	      this.sendMessage(clientId, fullMsg)
		.then(resolve)
		.catch(reject);
	    });
	} else {
	  const result = `error: bad subscribe command`;
	  log(`sending ${result} to client ${clientId}`);
	  this.sendMessage(clientId, `${result}`)
	    .then(resolve)
	    .catch(reject);
	}
      } else {
	const msg = `bad command: |${trunc(data)}|`;
	console.log(`sending ${msg} to client ${clientId}`);
	this.sendMessage(clientId, msg)
	  .then(resolve)
	  .catch(reject);
      }
    });
  }

  /**
     subscribe() - returns a promise.
     write a "machine" command followed by the serialization of the
     indicated machine. If no such machine, then reject.
  */
  subscribe(clientId, machine) {
    return new Promise( (resolve, reject) => {
      if (typeof machine !== 'string' || !machine.match(/^[a-z0-9]+$/)) {
	return reject(`subscribe: bad machine name: ${machine}`);
      }
      const rec = this._clientMap.get(clientId);
      if (! rec) {
	return reject(`subscribe(${machine}): no such client: ${clientId}`);
      } else if (rec.machines.includes(machine)) {
	log(`subscribe(${machine}): already subscribed`);
	return resolve();
      } else if (! this._machineMap.has(machine)) {
	return reject(`subscribe: no such machine: ${machine}`);
      }
      rec.machines.push(machine);
      log(`sending machine ${machine} to client ${clientId}`);
      this.sendMachine(machine, rec.wse)
	.then( resolve )
	.catch( errMsg => reject(`failed sending ${machine}: ${errMsg}`) );
    });
  }
  provide(machine, m) {
    if (this._machineMap.has(machine)) {
      const msg = `provide(${machine}) - already exists`;
      log(msg);
      return msg;
    } else {
      this._machineMap.set(machine, m);
      log(`machine ${machine} being provided`);
      m.addBlockListener( opArr => this.sendUpdates(machine, opArr) );
    }
    log(`looking for subscribed clients for ${machine}...`);
    let subscribedClients = 0;
    for (const c of this._clientMap.keys()) {
      const rec = this._clientMap.get(c);
      log(`   clientId ${c}: machines = ${rec.machines.join(" ")}`);
      if (rec.machines.includes(machine)) {
	subscribedClients ++;
	log(`sending ${machine} to ${c}`);
	this.sendMachine(machine, rec.wse)
	  .then( () => log(`machine ${machine} sent.`) )
	  .catch( (errMsg) => log(`failed sending ${machine}: ${errMsg}`));
      }
    }
    log(subscribedClients
	? `sent ${machine} to ${subscribedClients} clients`
	: `no clients are subscribed to ${machine}`);
    return null;
  }

  sendMachine(machine, wse) {
    return new Promise( (resolve, reject) => {
      const m = this._machineMap.get(machine);
      const ser = m.getSerialization();
      const serStr = ser.join('\n');
      log(`sendMachine ${machine} = |${ser.join(' ')}|`);
      const result = 
	    wse.sendMessage(`machine ${machine}\n${serStr}\n`, errMsg => {
	      if (errMsg) {
		const fullMsg = `error sending machine: ${machine}: ${errMsg}`;
		log(fullMsg);
		reject(fullMsg);
	      } else {
		log(`machine ${machine} sent`);
		resolve();
	      }
	    });
      if (result) {
	log(`wse.sendMessage reurned ${result}`);
      }
    });
  }

  sendUpdates(machine, opArr, cb) {
    let outstandingClients = 0; // how many in process of sending
    let lastError = null; // message of the last update that failed
    for (const c of this._clientMap.keys()) {
      const rec = this._clientMap.get(c);
      if (rec.machines.includes(machine)) {
	outstandingClients++;
	log(`sending ${machine} update to ${c}`);
	this.sendUpdate(machine, opArr, rec.wse, (result) => {
	  if (result) { lastError = result; }
	  outstandingClients --;
	});
      }
    }
    waitForOutstandingClients( () => cb(lastError) );

    function waitForOutstandingClients(cb) {
      if (outstandingClients > 0) {
	setTimeout( () => waitForOutstandingClients(cb), 100 );
      } else {
	return cb();
      }
    }
  }
  sendUpdate(machine, opArr, wse, cb) {
    const m = this._machineMap.get(machine);
    const ser = opArr.join('\n');
    const result = wse.sendMessage(`update ${machine}\n${ser}\n`, () => {
      result
	? log(`${machine} update sent`)
	: log(`${machine} update failed: ${result}`);
      return cb(result);
    });
  }
  sendMessage(clientId, message) {
    return new Promise( (resolve, reject) => {
      const rec = this._clientMap.get(clientId);
      log(`sending message ${trunc(message)}`);
      rec.wse.sendMessage(message, () => {
	resolve();
      });
    });
  }
}

function trunc(logmsg) {
  if (logmsg && logmsg.length > 10) {
    return logmsg.substr(0,10) + '...';
  } else {
    return logmsg;
  }
}

function schedulePing(wse) {
  setTimeout( () => {
    wse.sendPing('howdy', () => log(`ping sent: howdy`) );
  }, 1000);
}

// create logging function log(str). Copy and paste these lines.
const logger = {};
require('./debug-log.js')
  .registerLogger('broker', logger);
function log(str) { logger.log(str); }


module.exports = new Broker();
