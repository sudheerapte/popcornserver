"use strict";

const [log, err] = require('./logerr.js');
const appServer = require('../app-server.js');
const net = require('net');
const SSEmitter = require('../sse.js');
const Machine = require('../machine.js');

let sock1, sock2; // for sendBadCommand and sendMachine, respectively
let sse1, sse2;

let mc = new Machine();

const PORT=8001;
appServer.on('appConnect', () => log(`appServer appConnect emitted`) );
appServer.on('appDisconnect', () => log(`appServer appConnect emitted`) );
appServer.on('provide', () => log(`appServer provide emitted`) );
appServer.on('abandon', () => log(`appServer abandon emitted`) );

appServer.startListening({port:PORT})
  .then( createSock1 )
  .then( sendConnect1 ) // connect client1
  .then( sendBadCommand1 ) // badcommand
  .then( createSock2 )
  .then( sendConnect2 ) // connect client2
  .then( sendProvideFoo )
  .then( sendProvideBar )
  .then( sendUpdateFoo )
  .then( sendAbandonFoo )
  .then( sendOneShotProvide )  
  .then( sendOneShotUpdate )  
  .then( sendOneShotBadUpdate )  
  .then( sendBadOneShotCommand )
  .then( sendBadOneShotProvide )
/*  TODO fireAndForget not implemented
  .then( sendFireAndForget )
  .then( sendBadFireAndForget )
*/
  .then( () => {
    log(`--- all appServer tests happy.`);
    process.exit(0);
  })
  .catch(errMsg => err(`test failed: ${errMsg}`));

function createSock1() {
  log(`--- appConnect sending bad command`);
  return new Promise( (resolve, reject) => {
    sock1 = net.createConnection({port:PORT}, () => {
      resolve();
    });
  });
}

function sendConnect1() {
  log(`--- connect with sse1 and get back "ok"`);
  return new Promise( (resolve, reject) => {
    sock1.on('error', errMsg => log(`client1 got error: ${errMsg}`) );
    sock1.on('end', () => {
      log(`client1 got dropped.`);
      sock1.end();
    });
    let connected = false; // after we get "ok" for appConnect
    sse1 = new SSEmitter();
    sse1.setWriteStream(sock1);
    sse1.readFrom(sock1);
    sse1.once('SSEvent', ev => {
      if (! connected && ev.data === 'ok') {
        connected = true;
        return resolve();
      } else {
        return reject(`sendConnect got back |${ev.data}|`);
      }
    });
    sock1.write(`event: appConnect
data: client1\n\n`);
  });    
}

function sendBadCommand1() {
  log(`--- client1 sends bad command`);
  return new Promise( (resolve, reject) => {
    sock1.on('error', errMsg => log(`client1 got error: ${errMsg}`) );
    sock1.on('end', () => {
      log(`client1 got dropped.`);
      sock1.end();
      resolve();
    });
    let done = false; // after we get response for badcommand
    sse1.once('SSEvent', ev => {
      if (! done) {
        done = true;
        if (ev.data === "ok") {
          return reject(`client1 got ok, but was expecting error`);
        } else {
          log(`client1 got |${ev.data}|, as expected`);
          return resolve();
        }
      } else {
        log(`client1 got back |${ev.data}| after done!`);
      }
    });
    sse1.sendMessage(`badcommand`);
  });
}

function createSock2() {
  log(`--- appConnect for sending provide command`);
  return new Promise( (resolve, reject) => {
    sock2 = net.createConnection({port:PORT}, () => {
      resolve();
    });
  });
}

function sendConnect2() {
  log(`--- connect with sse2 and get back "ok"`);
  return new Promise( (resolve, reject) => {
    sock2.on('error', errMsg => log(`client2 got error: ${errMsg}`) );
    sock2.on('end', () => {
      log(`client2 got dropped.`);
      sock2.end();
    });
    let connected = false; // after we get "ok" for appConnect
    sse2 = new SSEmitter();
    sse2.setWriteStream(sock2);
    sse2.readFrom(sock2);
    sse2.once('SSEvent', ev => {
      if (! connected && ev.data === 'ok') {
        log(`client2 got connected.`);
        connected = true;
        return resolve();
      } else {
        return reject(`sendConnect got back |${ev.data}|`);
      }
    });
    sock2.write(`event: appConnect
data: client2\n\n`);
  });    
}

function sendProvideFoo() {
  return new Promise( (resolve, reject) => {
    sse2.once('SSEvent', ev => {
      log(`client2 got after provide foo: |${ev.data}|`);
      if(ev.data === "ok") {
	resolve();
      }
    });
    const result = mc.interpret(
      ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar"]);
    err(result);
    sse2.sendMessage(`provide foo
${mc.serialize().join('\n')}`);
    log(`client2 sent provide foo`);
  });
}
function sendProvideBar() {
  mc = new Machine;
  return new Promise( (resolve, reject) => {
    sse2.once('SSEvent', ev => {
      log(`client2 got after provide bar: |${ev.data}|`);
      if(ev.data === "ok") {
	resolve();
      }
    });
    const result = mc.interpret(
      ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo", "addLeaf .a / bar"]);
    err(result);
    sse2.sendMessage(`provide bar
${mc.serialize().join('\n')}`);
    log(`client2 sent provide bar`);
  });
}
function sendUpdateFoo() {
  return new Promise( (resolve, reject) => {
    sse2.once('SSEvent', ev => {
      log(`client2 got after update foo: |${ev.data}|`);
      if(ev.data === "ok") {
	resolve();
      }
    });
    const updateLines =["setCurrent .a bar"];
    sse2.sendMessage(`update foo
${updateLines.join('\n')}`);
    log(`client2 sent update foo`);
  });
}

function sendAbandonFoo() {
  return new Promise( (resolve, reject) => {
    sse2.once('SSEvent', ev => {
      log(`client2 got after abandon foo: |${ev.data}|`);
      if(ev.data === "ok") {
	resolve();
      }
    });
    sse2.sendMessage(`abandon foo`);
    log(`client2 sent abandon foo`);
  });
}

let sock3, sse3;
function sendOneShotProvide() {
  const testName = "sendOneShotProvide";
  log(`--- ${testName}`);
  return new Promise( (resolve, reject) => {
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sock3.on('error', errMsg => log(`${testName} got: ${errMsg}`) );
      sock3.on('data', data => {
        data = data.toString();
        log(`${testName} got: |${data.split('\n').join("\\n")}|}`);
        if (data.trim().endsWith('ok')) {
          done = true;
          return resolve();
        } else {
          done = true;
          log(`${testName} got error: ${data}`);
          return reject();
        }
      });
      sock3.on('end', () => {
	if (!done) {
	  log(`${testName} got dropped! Dropping my end`);
	  sock3.end();
	  done = true;
          resolve();
	} else {
	  log(`${testName} got dropped. I had already dropped my end`);
        }
      });
      const mc = new Machine();
      const result = mc.interpret(
        ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo",
         "addLeaf .a / bar"]);
      err(result);
      const sseEv = `event: oneShotCommand
data: provide bar
${mc.serialize().map( line => 'data: ' + line).join('\n')}\n\n`;
      // log(`sending: |${sseEv}|`);
      sock3.write(sseEv);
      log(`${testName} sent oneShotCommand with provide bar`);
    });
  });
}

function sendOneShotUpdate() {
  const testName = "sendOneShotUpdate";
  log(`--- ${testName}`);
  return new Promise( (resolve, reject) => {
    sock3.destroy();
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sock3.on('error', errMsg => log(`${testName} got: ${errMsg}`) );
      sock3.on('data', data => {
        data = data.toString();
        log(`${testName} got: |${data.split('\n').join("\\n")}|}`);
        if (data.trim().endsWith('ok')) {
          done = true;
          return resolve();
        } else {
          done = true;
          log(`${testName} got error: ${data}`);
          return reject();
        }
      });
      sock3.on('end', () => {
	if (!done) {
	  log(`${testName} got dropped! Dropping my end`);
	  sock3.end();
	  done = true;
          resolve();
	} else {
	  log(`${testName} got dropped. I had already dropped my end`);
        }
      });
      const sseEv = `event: oneShotCommand
data: update bar
data: setCurrent .a bar\n\n`;
      log(`sending: |${sseEv}|`);
      sock3.write(sseEv);
      log(`${testName} sent update bar`);
    });
  });
}
function sendOneShotBadUpdate() {
  const testName = "sendOneShotBadUpdate";
  log(`--- ${testName}`);
  return new Promise( (resolve, reject) => {
    sock3.destroy();
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sock3.on('error', errMsg => log(`${testName} got: ${errMsg}`) );
      sock3.on('data', data => {
        data = data.toString();
        log(`${testName} got: |${data}|`);
        if (data.trim().endsWith('ok')) {
          done = true;
          return reject(`${testName} got OK!`);
        } else {
          done = true;
          log(`${testName} got: ${data}`);
          return resolve();
        }
      });
      sock3.on('end', () => {
	if (!done) {
	  log(`${testName} got dropped! Dropping my end`);
	  sock3.end();
	  done = true;
          resolve();
	} else {
	  log(`${testName} got dropped. I had already dropped my end`);
        }
      });
      const sseEv = `event: oneShotCommand
data: update bar
data: setCurrent .c bar\n\n`;
      log(`sending: |${sseEv}|`);
      sock3.write(sseEv);
      log(`${testName} sent update bar`);
    });
  });
}

function sendBadOneShotCommand() {
  log(`--- oneShotCommand sending bad command`);
  const testName = "sendBadOneShotCommand";
  return new Promise( (resolve, reject) => {
    sock3.destroy();
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sock3.on('error', errMsg =>
               log(`sendOneShotCommand got error: ${errMsg}`) );
      sock3.on('data', data => {
        data = data.toString();
        // log(`sendOneShot got: |${data}|`);
        if (data.trim().endsWith('ok')) {
          done = true;
          return reject(`got OK! expecting an error`);
        } else {
          done = true;
          // log(`sendOneShot got error: ${data}`);
          return resolve();
        }
      });
      sock3.on('end', () => {
	if (!done) {
	  log(`${testName} got dropped! Dropping my end`);
	  sock3.end();
	  done = true;
          resolve();
	} else {
	  log(`${testName} got dropped. I had already dropped my end`);
        }
      });
      const mc = new Machine();
      const result = mc.interpret(
        ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo"]);
      err(result);
      const sseEv = `event: oneShotCommand
data: something bar
${mc.serialize().map( line => 'data: ' + line).join('\n')}\n\n`;
      // log(`sending: |${sseEv}|`);
      sock3.write(sseEv);
      log(`${testName}: sent oneShotCommand with bad command`);
    });
  });
}

function sendBadOneShotProvide() {
  log(`--- oneShotCommand bad provide`);
  return new Promise( (resolve, reject) => {
    sock3.destroy();
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sock3.on('error', errMsg =>
               log(`sendOneShotCommand got error: ${errMsg}`) );
      sock3.on('data', data => {
        data = data.toString();
        // log(`sendOneShot got: |${data}|`);
        if (data.trim().endsWith('ok')) {
          done = true;
          return reject(`got OK! expecting an error`);
        } else {
          done = true;
          // log(`sendOneShot got error: ${data}`);
          return resolve();
        }
      });
      sock3.on('end', () => {
	if (!done) {
	  log(`sendOneShotCommand got dropped! Dropping my end`);
	  sock3.end();
	  done = true;
          resolve();
	} else {
	  log(`sendOneShotCommand got dropped. I had already dropped my end`);
        }
      });
      const mc = new Machine();
      const result = mc.interpret(
        ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo"]);
      err(result);
      const sseEv = `event: oneShotCommand
data: provide bar\n\n`;
      // log(`sending: |${sseEv}|`);
      sock3.write(sseEv);
      log(`sent oneShotCommand with bad provide bar payload`);
    });
  });
}

function sendFireAndForget() {
  log(`--- fireAndForget sending machine command`);
  sock3.destroy();
  return new Promise( (resolve, reject) => {
    sock3 = net.createConnection({port:PORT}, () => {
      sse3 = new SSEmitter();
      sse3.setWriteStream(sock3);
      sse3.readFrom(sock3);
      sock3.on('error', errMsg => log(`fireAndForget got: ${errMsg}`) );
      sock3.on('end', () => {
	log(`fireAndForget got dropped.`);
	resolve();
      });
      sse3.on('SSEvent', ev => {
	if(ev.type === "replyError") {
	  sock3.end();
	}
      });
      const mc = new Machine();
      const result = mc.interpret(
        ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo"]);
      err(result);
      sse3.sendEvent({type: "fireAndForget",
		      data: `machine baz
${mc.serialize().join('\n')}\n\n`});
      log(`sent fireAndForget machine baz`);
      sock3.end( () => log(`closed my fireAndForget socket`) );
    });
  });
}

function sendBadFireAndForget() {
  log(`--- fireAndForget sending bad command`);
  sock3.destroy();
  return new Promise( (resolve, reject) => {
    sock3 = net.createConnection({port:PORT}, () => {
      sse3 = new SSEmitter();
      sse3.setWriteStream(sock3);
      sse3.readFrom(sock3);
      sock3.on('error', errMsg => log(`bad fireAndForget got: ${errMsg}`) );
      sock3.on('end', () => {
	log(`bad fireAndForget got dropped.`);
	resolve();
      });
      sse3.on('SSEvent', ev => {
	log(`badFireAndForget got: ${ev.data}!`);
	if(ev.type === "replyError") {
	  sock3.end();
	}
	err(`badFireAndForget got: ${ev.data}!`);
      });
      const mc = new Machine();
      const result = mc.interpret(
        ["addLeaf . a", "addLeaf . b", "addLeaf .a / foo"]);
      err(result);
      sse3.sendEvent({type: "fireAndForget",
		      data: `badcommand
${mc.serialize().join('\n')}\n\n`});
      log(`sent fireAndForget machine baz`);
      sock3.end( () => log(`closed my bad fireAndForget socket`) );
    });
  });
}


// -----------------

process.on('beforeExit', code => {
  if (code === 0) {
    /* if (! newmachineReceived) { err("no newmachineReceived"); } */
  }
});

