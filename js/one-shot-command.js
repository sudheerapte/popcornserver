"use strict";

const sendOneShot = require('./send-one-shot.js');

sendOneShot.getPopcornSocketP()
  .then( sock => sendOneShot.sendStringP(sock, `provide foo
P .a
P .b
`) )
  .then( reply => {
    if (! reply.toString().includes('ok')) {
      console.log(`ok not found`);
    } else {
      console.log(`reply = |${reply}|`);
    }
  })
  .catch( errMsg => console.log(errMsg) );
