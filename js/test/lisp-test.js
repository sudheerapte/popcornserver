"use strict";

const [log, err, errDiff] = require('./logerr.js');
const lisp = require('../lisp.js');

let testScript;
let result;
let tok = null;
let tokArr = [];

let tokenTests = [
  { input: "( one two three)", err: null, count: 5 },
  { input: "( \"one\" two three)", err: null, count: 5 },
  { input: "(\"one\" \"t\"wo three)", err: null, count: 6 },
  { input: "(\"one\"\"two\" three)", err: null, count: 5 },
  { input: "'(\"one\"\"two\" three)", err: null, count: 6 },
  { input: "\"one string\"", err: null, count: 1 },
  { input: "\"one \\\"string\"", err: null, count: 1 },
];  

verifyTokenTests();

function verifyTokenTests() {
  tokenTests.forEach( t => {
    const tokArr = [];
    const result = lisp.tokenize(t.input, tokArr);
    errDiff(result, t.err);
    if (tokArr.length!=t.count) {
      log(`bad tokArr length for |${t.input}|:`);
      log(tokArr);
      process.exit(0);
    }
    log(`${" ".repeat(40-t.input.length)}${t.input} => ${tokArr.length}`);
  });
}


