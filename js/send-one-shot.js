"use strict";

const fs = require('fs');
const net = require('net');
const GetOptions = require('./get-options.js');
const logger = {};
require('./debug-log.js')
  .registerLogger('send-one-shot', logger);

let commandArr; // read in by slurpCommand()

slurpCommand()
  .then( GetOptions.get )
  .then( pOptions => {
    // log(`pOptions = ${JSON.stringify(pOptions)}`);
    const options = {host: "localhost", port: pOptions.appPort};
    // log(`options = ${JSON.stringify(options)}`);
    const sock = net.createConnection(options, () => {
      sendArr(sock, ["data: provide foo", "data: P .a", "data: P .b"])
        .then( () => log(`done`) )
        .catch( errMsg => log(errMsg) );
    });
  })
  .catch( errMsg => console.log(errMsg) );


function slurpCommand() {
  return new Promise( (resolve, reject) => {
    log(`send-one-shot argv.length = ${process.argv.length}`);
    if (process.argv.length !== 3) {
      console.log(`Usage:
  Read from stdin:
      node send-one-shot.js -
  Read from file:
      node send-one-shot.js FILENAME`);
      process.exit(0);
    }
    const filename = process.argv[2];
    if (filename === '-') {
      log(`reading from stdin`);
      console.log(`TODO STDIN not implemented`);
      process.exit(0);
    } else {
      log(`reading from file ${filename}`);
      fs.readFileSync(filename);
    }
    
  });
}

function sendArr(sock, arr) {
  return new Promise( (resolve, reject) => {
    let done = false;
    sock.on('error', errMsg => {
      done = true;
      return reject(errMsg);
    });
    sock.on('end', () => {
      if (done) { return; }
      log(`got dropped.`);
      done = true;
      sock.end();
      return resolve();
    });
    sock.on('data', data => {
      data = data.toString();
      if (data && data.includes(' replySuccess')) {
        done = true;
        return resolve();
      } else {
        done = true;
        const replyArr = data.split(/\r\n|\n/);
        const msg = (replyArr.length < 2) ? "data: (replyError)" : replyArr[1];
        return reject(msg.slice(6)); // remove "data: "
      }
    });
    const firstCommand = `event: oneShotCommand` +
          arr.join('\n') + '\n\n';
    log(`sending first command: |${arr.join(", ")}|`);
    sock.write(firstCommand);
  });
}

// create logging function log(str). Copy and paste these lines.
function log(str) { logger.log(str); }
