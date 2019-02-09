"use strict";

const [log, err] = require('./logerr.js');
const appServer = require('../app-server.js');
const net = require('net');
const SSEmitter = require('../sse.js');
const Machine = require('../machine.js');

let sock1, sock2; // for sendBadCommand and sendMachine, respectively
let sse1, sse2;

const PORT=8001;
appServer.startListening({port:PORT})
  .then( createSock1 )
  .then( sendBadCommand )
  .then( createSock2 )
  .then( sendMachine )
  .then( sendOneShotCommand )
  .then( sendBadOneShotCommand )
  .then( sendFireAndForget )
  .then( sendBadFireAndForget )
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
function sendBadCommand() {
  return new Promise( (resolve, reject) => {
    sock1.on('error', errMsg => log(`client1 got error: ${errMsg}`) );
    sock1.on('end', () => {
      log(`client1 got dropped.`);
      sock1.end();
      resolve();
    });
    let done = false;
    sse1 = new SSEmitter();
    sse1.setWriteStream(sock1);
    sse1.readFrom(sock1);
    sse1.on('SSEvent', ev => {
      if (done) { return; }
      if (ev.data === 'ok') {
	done = true;
	log(`client1 got: |${ev.data}|`);
	reject(`client1 got ok!`);
      } else if (ev.data.length > 0) {
	done = true;
	log(`client1 got: |${ev.data}|`);
      }
    });
    sock1.write(`event: appConnect
data: badcommand\n\n`);
  });    
}
function createSock2() {
  log(`--- appConnect sending machine command`);
  return new Promise( (resolve, reject) => {
    sock2 = net.createConnection({port:PORT}, () => {
      resolve();
    });
  });
}

function sendMachine() {
  return new Promise( (resolve, reject) => {
    let done = false;
    sse2 = new SSEmitter();
    sse2.setWriteStream(sock2);
    sse2.readFrom(sock2);
    sock2.on('error', errMsg => log(`client2 got error: ${errMsg}`) );
    sock2.on('end', () => {
      if (!done) {
	log(`client2 got dropped! Dropping my end`);
	sock2.end();
	done = true;
	reject(`client2 got dropped!`);
      }
    });
    sse2.on('SSEvent', ev => {
      if (done) { return; }
      log(`client2 got: |${ev.data}|`);
      if(ev.data === "ok") {
	sock2.end();
	done = true;
	resolve();
      }
    });
    const mc = new Machine();
    const result = mc.interpret(["P .a", "P .b", "P .a/foo"]);
    err(result);
    sse2.sendEvent({type: "appConnect",
		    data: `machine foo
${mc.getSerialization().join('\n')}\n\n`});
    log(`sent appConnect with machine`);
/*    sock.write(`event: appConnect
data: machine foo
${mc.getSerialization().join('\n')}\n\n`, resolve); */
  });
}

let sock3, sse3;
function sendOneShotCommand() {
  log(`--- oneShotCommand machine bar`);
  return new Promise( (resolve, reject) => {
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sse3 = new SSEmitter();
      sse3.setWriteStream(sock3);
      sse3.readFrom(sock3);
      sock3.on('error', errMsg => log(`sendOneShotCommand got: ${errMsg}`) );
      sock3.on('end', () => {
	if (!done) {
	  log(`sendOneShotCommand got dropped! Dropping my end`);
	  sock3.end();
	  done = true;
	  reject(`sendOneShotCommand got dropped!`);
	}
      });
      sse3.on('SSEvent', ev => {
	if (done) { return; }
	log(`sendOneShotCommand got: |${ev.data}|`);
	if(ev.data === "ok") {
	  sock3.end();
	  done = true;
	  resolve();
	}
      });
      const mc = new Machine();
      const result = mc.interpret(["P .a", "P .b", "P .a/foo"]);
      err(result);
      sse3.sendEvent({type: "oneShotCommand",
		      data: `machine bar
${mc.getSerialization().join('\n')}\n\n`});
      log(`sent oneShotCommand with machine bar`);
    });
  });
}

function sendBadOneShotCommand() {
  log(`--- oneShotCommand sending bad command`);
  sock3.destroy();
  return new Promise( (resolve, reject) => {
    sock3 = net.createConnection({port:PORT}, () => {
      let done = false;
      sse3 = new SSEmitter();
      sse3.setWriteStream(sock3);
      sse3.readFrom(sock3);
      sock3.on('error', errMsg => log(`sendBadOneShotCommand got: ${errMsg}`) );
      sock3.on('end', () => {
	if (!done) {
	  log(`sendBadOneShotCommand got dropped. Dropping my end`);
	  sock3.end();
	  done = true;
	  reject(`sendBadOneShotCommand got dropped!`);
	}
      });
      sse3.on('SSEvent', ev => {
	if (done) { return; }
	if(ev.type === "replyError") {
	  sock3.end();
	  done = true;
	  resolve();
	}
      });
      const mc = new Machine();
      const result = mc.interpret(["P .a", "P .b", "P .a/foo"]);
      err(result);
      sse3.sendEvent({type: "oneShotCommand",
		      data: `badcommand
${mc.getSerialization().join('\n')}\n\n`});
      log(`sent oneShotCommand with badcommand`);
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
      const result = mc.interpret(["P .a", "P .b", "P .a/foo"]);
      err(result);
      sse3.sendEvent({type: "fireAndForget",
		      data: `machine baz
${mc.getSerialization().join('\n')}\n\n`});
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
      const result = mc.interpret(["P .a", "P .b", "P .a/foo"]);
      err(result);
      sse3.sendEvent({type: "fireAndForget",
		      data: `badcommand
${mc.getSerialization().join('\n')}\n\n`});
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

