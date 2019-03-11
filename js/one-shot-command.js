"use strict";

/**
   Usage:

     echo SOMECOMMANDSTRING | node one-shot-command.js

   Use POPCORNHOST and POPCORNPORT env variables to find popcorn
   app server. Otherwise we will use localhost:8001.

*/

const sendOneShot = require('./send-one-shot.js');

let command = "";
process.stdin.setEncoding('utf8');
process.stdin.on('readable', () => {
  const chunk = process.stdin.read();
  if (chunk !== null) {
    command += chunk;
  }
});
process.stdin.on('end', () => {
  process.stdout.write(`sending to popcorn:|${command}|\n`);
  sendToPopcorn(command);
});

setTimeout( () => {
  process.stdout.write('timeout');
  process.exit(1);
}, 2000);

function sendToPopcorn(cmd) {
  sendOneShot.getPopcornSocketP()
    .then( sock => sendOneShot.sendStringP(sock, cmd) )
    .then( reply => {
      if (! reply.toString().includes('ok')) {
        console.log(reply.toString());
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch( errMsg => {
      console.log(errMsg);
      process.exit(1);
    });
}
